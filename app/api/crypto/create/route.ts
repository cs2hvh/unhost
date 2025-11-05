import { NextRequest, NextResponse } from 'next/server'
import { getUserFromHeaders } from '@/lib/supabase/user'
import { createUnpaymentsAPI } from '@/lib/unpayments'
import { calculateCryptoDepositFee, formatFeeStructure } from '@/config/fees'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromHeaders()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { amount, currency } = body

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Valid amount is required'
      }, { status: 400 })
    }

    if (!currency) {
      return NextResponse.json({
        success: false,
        error: 'Currency is required'
      }, { status: 400 })
    }

    const baseAmount = parseFloat(amount)

    // Validate amount limits
    if (baseAmount < 20) {
      return NextResponse.json({
        success: false,
        error: 'Minimum amount is $20.00'
      }, { status: 400 })
    }

    const callbackUrl = process.env.UNPAYMENTS_IPN_WEBHOOK || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Calculate fee using new fee structure
    const feeAmount = calculateCryptoDepositFee(currency, baseAmount)
    const totalAmount = baseAmount + feeAmount

    console.log('Creating Unpayments payment:', {
      baseAmount: baseAmount.toFixed(2),
      feeAmount: feeAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      currency,
      userId: user.id,
      feeStructure: formatFeeStructure(currency)
    })

    // Create payment with Unpaymentss
    const unpayments = createUnpaymentsAPI()
    const paymentResponse = await unpayments.createPayment({
      currency,
      amount: totalAmount.toFixed(2),
      callback_url: callbackUrl,
      expires_in_hours: 24,
      metadata: {
        user_id: user.id,
        base_amount: baseAmount,
        fee_amount: feeAmount,
        fee_structure: formatFeeStructure(currency)
      }
    })

    if (!paymentResponse.success) {
      throw new Error('Failed to create payment, please contact support.')
    }

    const paymentData = paymentResponse.data!

    // Call crypto_create_payment function
    const supabase = await createClient()
    const { data: transactionData, error: functionError } = await supabase
      .rpc('crypto_create_payment', {
        p_user_id: user.id,
        p_order_id: paymentData.order_id,
        p_amount: baseAmount,
        p_fee_amount: feeAmount,
        p_currency: currency,
        p_payment_provider: 'unpayments',
        p_payment_id: paymentData.order_id,
        p_payment_url: paymentData.order_id,
        p_metadata: {
          unpayments_response: paymentData,
          base_amount: baseAmount,
          total_amount: totalAmount,
          fee_structure: formatFeeStructure(currency),
          pay_address: paymentData.address,
          currency: paymentData.currency,
          status: paymentData.status,
          confirmations_required: paymentData.confirmations_required,
          expires_at: paymentData.expires_at,
          created_at: paymentData.created_at
        }
      })

    if (functionError) {
      console.error('Failed to create payment record:', functionError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create payment, please contact support.'
      }, { status: 500 })
    }

    console.log('Payment record created successfully:', paymentData)

    return NextResponse.json({
      success: true,
      order_id: paymentData.order_id,
      amount: baseAmount.toFixed(2),
      fee: feeAmount.toFixed(2),
      total: totalAmount.toFixed(2),
      fee_structure: formatFeeStructure(currency),
      pay_address: paymentData.address,
      currency: paymentData.currency,
      status: paymentData.status,
      confirmations_required: paymentData.confirmations_required,
      expires_at: paymentData.expires_at,
      created_at: paymentData.created_at,
      transaction_id: transactionData?.[0]?.transaction_id,
    })

  } catch (error) {
    console.error('Unpayments payment creation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}