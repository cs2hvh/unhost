'use server'

import { createUnpaymentsAPI } from '@/lib/unpayments'
import { calculateCryptoDepositFee, formatFeeStructure, MINIMUM_DEPOSIT_AMOUNT } from '@/config/fees'
import { createAdminClient } from '@/lib/supabase/admin'

interface CurrencyInfo {
  code: string
  confirmations_required: number
}

interface GetCurrenciesResult {
  success: boolean
  currencies?: CurrencyInfo[]
  error?: string
}

interface CreatePaymentParams {
  amount: number
  currency: string
}

interface CreatePaymentResult {
  success: boolean
  order_id?: string
  amount?: string
  fee?: string
  total?: string
  fee_structure?: string
  pay_address?: string
  currency?: string
  status?: string
  confirmations_required?: number
  expires_at?: string
  created_at?: string
  transaction_id?: string
  error?: string
}

/**
 * Get supported cryptocurrencies from Unpayments
 */
export async function getCurrencies(): Promise<GetCurrenciesResult> {
  try {
    const unpayments = createUnpaymentsAPI()
    const currencies = unpayments.getSupportedCurrencies()

    // Return currencies with their confirmation requirements
    const currencyDetails = currencies.map(code => ({
      code,
      confirmations_required: unpayments.getConfirmationsRequired(code)
    }))

    return {
      success: true,
      currencies: currencyDetails
    }
  } catch (error) {
    console.error('Error fetching Unpayments currencies:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch currencies'
    }
  }
}

/**
 * Create a new crypto payment
 */
export async function createCryptoPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
  try {
    // Create Supabase client with the user's access token
    const supabase = createAdminClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    const userId = user.id
    const { amount, currency } = params

    // Validate amount
    if (!amount || isNaN(parseFloat(String(amount))) || parseFloat(String(amount)) <= 0) {
      return {
        success: false,
        error: 'Valid amount is required'
      }
    }

    // Validate currency
    if (!currency) {
      return {
        success: false,
        error: 'Currency is required'
      }
    }

    const baseAmount = parseFloat(String(amount))

    // Validate amount limits
    if (baseAmount < MINIMUM_DEPOSIT_AMOUNT) {
      return {
        success: false,
        error: 'Minimum amount is $20.00'
      }
    }

    const callbackUrl = process.env.UNPAYMENTS_IPN_WEBHOOK || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Calculate fee using fee structure
    const feeAmount = calculateCryptoDepositFee(currency, baseAmount)
    const totalAmount = baseAmount + feeAmount

    console.log('Creating Unpayments payment:', {
      baseAmount: baseAmount.toFixed(2),
      feeAmount: feeAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      currency,
      userId,
      feeStructure: formatFeeStructure(currency)
    })

    // Create payment with Unpayments
    const unpayments = createUnpaymentsAPI()
    const paymentResponse = await unpayments.createPayment({
      currency,
      amount: totalAmount.toFixed(2),
      callback_url: callbackUrl,
      expires_in_hours: 24,
      metadata: {
        user_id: userId,
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
    const { data: transactionData, error: functionError } = await supabase
      .rpc('crypto_create_payment', {
        p_user_id: userId,
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
      return {
        success: false,
        error: 'Failed to create payment, please contact support.'
      }
    }

    console.log('Payment record created successfully:', paymentData)

    return {
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
    }

  } catch (error) {
    console.error('Unpayments payment creation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }
  }
}
