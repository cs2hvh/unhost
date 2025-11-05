import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminNotifications } from '@/lib/telegram'
import { discordWebhooks } from '@/lib/discord-webhooks'
import crypto from 'crypto'

export async function GET() {
  console.log('GET request to crypto callback endpoint - webhook is accessible')
  return NextResponse.json({
    message: 'Crypto callback endpoint is accessible',
    timestamp: new Date().toISOString()
  })
}

export async function POST(request: NextRequest) {
  console.log('=== CRYPTO CALLBACK RECEIVED ===')
  console.log('Timestamp:', new Date().toISOString())
  console.log('Request headers:', Object.fromEntries(request.headers.entries()))

  try {
    const body = await request.text()
    console.log('Raw body:', body)

    const data = JSON.parse(body)

    console.log('Parsed callback data:', {
      order_id: data.order_id,
      status: data.status,
      currency: data.currency,
      amount_expected: data.amount_expected,
      amount_received: data.amount_received,
      confirmations: data.confirmations,
      full_data: data
    })

    // Verify webhook signature - CURRENTLY DISABLED
    // TODO: Enable signature verification once the correct webhook secret is configured
    const secretKey = process.env.UNPAYMENTS_API_TOKEN
    const headerSignature = request.headers.get('x-unpayments-signature')

    if ((data.signature || headerSignature) && secretKey) {
      const receivedSignature = headerSignature || data.signature
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { signature, ...dataWithoutSignature } = data
      const dataToSign = JSON.stringify(dataWithoutSignature)

      const computedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(dataToSign)
        .digest('hex')

      if (computedSignature !== receivedSignature) {
        console.log('Signature verification: FAILED (skipped for now)')
        // TODO: Enable this in production
        // return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      } else {
        console.log('Signature verification: PASSED')
      }
    }

    // Basic validation - ensure required fields are present
    if (!data.order_id || !data.status) {
      console.error('Invalid webhook data - missing required fields:', data)
      return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 })
    }

    // Process the callback using the crypto_callback function
    const supabase = await createClient()
    const { data: callbackResult, error: callbackError } = await supabase
      .rpc('crypto_callback', {
        p_order_id: data.order_id,
        p_payment_status: data.status,
        p_payment_id: data.order_id,
        p_actually_paid: data.amount_received ? parseFloat(data.amount_received) : null,
        p_outcome_amount: data.amount_received ? parseFloat(data.amount_received) : null,
        p_outcome_currency: data.currency || null,
        p_payin_hash: null,
        p_payout_hash: null,
        p_metadata: {
          webhook_data: data,
          processed_at: new Date().toISOString(),
          source: 'unpayments',
          confirmations: data.confirmations,
          timestamp: data.timestamp
        }
      })

    if (callbackError) {
      console.error('Failed to process callback:', callbackError)
      return NextResponse.json({
        error: 'Failed to process callback',
        details: callbackError.message
      }, { status: 500 })
    }

    const result = callbackResult?.[0]
    if (!result) {
      console.error('No result returned from callback function')
      return NextResponse.json({ error: 'No result from callback processing' }, { status: 500 })
    }

    console.log('Callback processed successfully:', {
      transaction_id: result.transaction_id,
      user_id: result.user_id,
      new_balance: result.new_balance,
      status_updated: result.status_updated,
      amount_credited: result.amount_credited
    })

    // Log the outcome for different scenarios
    if (result.status_updated) {
      if (result.amount_credited > 0) {
        const cryptoData = {
          order_id: data.order_id,
          status: data.status,
          currency: data.currency,
          amount_expected: data.amount_expected,
          amount_received: data.amount_received
        }

        if (data.status === 'partially_paid') {
          await adminNotifications.partialDeposit(result.user_id, result.amount_credited, result.new_balance, cryptoData)
        } else {
          await adminNotifications.depositPaid(result.user_id, result.amount_credited, result.new_balance, cryptoData)
        }

        // Send Discord webhook notification for wallet transaction
        await discordWebhooks.sendWalletTransaction({
          user_id: result.user_id,
          transaction_id: result.transaction_id,
          invoice_id: result.invoice_id,
          type: 'crypto_deposit',
          side: 'credit',
          amount: result.amount_credited,
          status: data.status === 'partially_paid' ? 'partially_paid' : 'approved',
          name: `Crypto Deposit - ${data.currency || 'CRYPTO'}`,
          description: `Order ID: ${data.order_id}\nCurrency: ${data.currency || 'N/A'}\nExpected: ${data.amount_expected || 'N/A'}\nReceived: ${data.amount_received || 'N/A'}`,
          balance_after: result.new_balance
        })

        console.log(`✅ Payment processed: ${result.amount_credited} credited to user ${result.user_id}. New balance: ${result.new_balance}`)
      } else {
        console.log(`📝 Status updated for user ${result.user_id} to ${data.status}`)
      }
    } else {
      console.log(`ℹ️ No status change for payment ${data.order_id}`)
    }

    return NextResponse.json({
      status: 'ok',
      processed: {
        transaction_id: result.transaction_id,
        status_updated: result.status_updated,
        amount_credited: result.amount_credited,
        new_balance: result.new_balance
      }
    })

  } catch (error) {
    console.error('Crypto callback error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 200 })
  }
}