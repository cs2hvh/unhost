// Unpayments API client - Custom crypto payment gateway
import crypto from "crypto"

interface UnpaymentsConfig {
  baseUrl: string
  apiToken: string
  ipnWebhook?: string
}

interface CreatePaymentRequest {
  currency: string
  amount: string
  callback_url?: string
  expires_in_hours?: number
  metadata?: Record<string, unknown>
}

interface CreatePaymentResponse {
  success: boolean
  data?: {
    order_id: string
    currency: string
    amount: string
    address: string
    status: string
    confirmations_required: number
    expires_at: string
    created_at: string
  }
  error?: string
}

interface PaymentStatusResponse {
  success: boolean
  data?: {
    order_id: string
    currency: string
    status: string
    amount_expected: string
    amount_received: string
    address: string
    confirmations_required: number
    expires_at: string
    created_at: string
    confirmed_at?: string
    transactions: Array<{
      txid: string
      amount: string
      confirmations: number
      status: string
      created_at: string
    }>
  }
  error?: string
}

interface ListPaymentsResponse {
  success: boolean
  data?: {
    payments: Array<{
      order_id: string
      currency: string
      status: string
      amount_expected: string
      amount_received: string
      wallet_address: string
      created_at: string
      confirmed_at?: string
    }>
    count: number
    limit: number
    offset: number
  }
  error?: string
}

interface WebhookPayload {
  order_id: string
  status: string
  currency: string
  amount_expected: string
  amount_received: string
  confirmations: number
  timestamp: string
  signature: string
}

export interface UWallet {
  id: number
  address: string
  is_assigned: boolean
  assigned_to_order?: string | null
  created_at: string
  last_used_at?: string | null
  currency: string
  currency_name: string
  network?: string
}

interface ListWalletsResponse {
  success: boolean
  data?: {
    wallets: UWallet[]
    total: number
    limit: number
    offset: number
  }
  error?: string
}

interface SingleWalletResponse {
  success: boolean
  data?: UWallet
  error?: string
}

interface GenerateWalletsRequest {
  currency: string
  count?: number
}

interface GenerateWalletsResponse {
  success: boolean
  data?: {
    currency: string
    count: number
    wallets: Array<{
      id: number
      address: string
    }>
  }
  error?: string
}

interface ImportWalletsRequest {
  currency: string
  wallets: Array<{
    address: string
    private_key: string
  }>
}

interface ImportWalletsResponse {
  success: boolean
  data?: {
    currency: string
    imported: number
    wallets: Array<{
      id: number
      address: string
    }>
  }
  error?: string
}

interface UpdateWalletRequest {
  is_assigned: boolean
}

interface UpdateWalletResponse {
  success: boolean
  data?: UWallet
  error?: string
}

interface DeleteWalletsRequest {
  wallet_ids: number[]
}

interface DeleteWalletsResponse {
  success: boolean
  data?: {
    deleted: number
    wallets: Array<{
      id: number
      address: string
    }>
  }
  error?: string
}

export const CURRENCIES = ['BTC', 'ETH', 'LTC', 'TRX', 'USDT_ERC20', 'USDT_TRC20', 'XMR']

class UnpaymentsAPI {
  private config: UnpaymentsConfig

  constructor(config: UnpaymentsConfig) {
    this.config = config
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json'
      }
    }

    if (body && (method === 'POST' || method === 'PATCH' || method === 'DELETE')) {
      options.body = JSON.stringify(body)
    }

    console.log(`Unpayments API ${method} ${url}`)

    const response = await fetch(url, options)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Unpayments API error: ${response.status} ${errorText}`)
      throw new Error(`Unpayments API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    // console.log(`Unpayments response:`, data)
    return data
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return this.makeRequest<CreatePaymentResponse>('/api/payments/create', 'POST', request as unknown as Record<string, unknown>)
  }

  async getPaymentStatus(orderId: string): Promise<PaymentStatusResponse> {
    return this.makeRequest<PaymentStatusResponse>(`/api/payments/${orderId}`)
  }

  async listPayments(params?: {
    status?: string
    currency?: string
    limit?: number
    offset?: number
  }): Promise<ListPaymentsResponse> {
    const queryParams = new URLSearchParams()

    if (params?.status) queryParams.append('status', params.status)
    if (params?.currency) queryParams.append('currency', params.currency)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())

    const query = queryParams.toString()
    const endpoint = query ? `/api/payments?${query}` : '/api/payments'

    return this.makeRequest<ListPaymentsResponse>(endpoint)
  }

  // Webhook signature verification using HMAC-SHA256
  verifyWebhookSignature(webhookData: WebhookPayload, secretKey: string): boolean {
    if (!secretKey) {
      console.warn('Webhook secret key not configured, skipping signature verification')
      return true
    }

    // Extract signature from payload
    const { signature, ...data } = webhookData

    // Log the data being used for signature computation
    const stringifiedData = JSON.stringify(data)
    console.log('=== SIGNATURE VERIFICATION DEBUG ===')
    console.log('Received webhook data:', webhookData)
    console.log('Data without signature:', data)
    console.log('Stringified data for HMAC:', stringifiedData)
    console.log('String length:', stringifiedData.length)
    console.log('Secret key (first 10 chars):', secretKey.substring(0, 10) + '...')

    // Compute expected signature
    const computedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(stringifiedData)
      .digest('hex')

    const isValid = computedSignature === signature

    console.log('Webhook signature verification:', {
      receivedSignature: signature,
      computedSignature,
      isValid,
      match: computedSignature === signature
    })

    // Try with sorted keys as well
    const sortedData = Object.keys(data).sort().reduce((obj, key) => {
      const typedKey = key as keyof typeof data
      obj[typedKey] = data[typedKey]
      return obj
    }, {} as Record<string, unknown>)
    const sortedStringified = JSON.stringify(sortedData)
    const sortedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(sortedStringified)
      .digest('hex')

    console.log('Trying with sorted keys:', {
      sortedStringified,
      sortedSignature,
      matchWithSorted: sortedSignature === signature
    })

    return isValid
  }

  // Get supported currencies (returns static list based on API docs)
  getSupportedCurrencies(): string[] {
    return CURRENCIES
  }

  // Get confirmations required for each currency
  getConfirmationsRequired(currency: string): number {
    const confirmations: Record<string, number> = {
      'BTC': 3,
      'ETH': 12,
      'LTC': 6,
      'TRX': 19,
      'USDT_ERC20': 12,
      'USDT_TRC20': 19
    }
    return confirmations[currency] || 12
  }

  // Wallet Management Methods
  async listWallets(params?: {
    currency?: string
    is_assigned?: boolean
    limit?: number
    offset?: number
  }): Promise<ListWalletsResponse> {
    const queryParams = new URLSearchParams()

    if (params?.currency) queryParams.append('currency', params.currency)
    if (params?.is_assigned !== undefined) queryParams.append('is_assigned', params.is_assigned.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())

    const query = queryParams.toString()
    const endpoint = query ? `/api/wallets?${query}` : '/api/wallets'

    return this.makeRequest<ListWalletsResponse>(endpoint)
  }

  async getWallet(id: number): Promise<SingleWalletResponse> {
    return this.makeRequest<SingleWalletResponse>(`/api/wallets/${id}`)
  }

  async generateWallets(request: GenerateWalletsRequest): Promise<GenerateWalletsResponse> {
    return this.makeRequest<GenerateWalletsResponse>('/api/wallets/generate', 'POST', request as unknown as Record<string, unknown>)
  }

  async importWallets(request: ImportWalletsRequest): Promise<ImportWalletsResponse> {
    return this.makeRequest<ImportWalletsResponse>('/api/wallets/import', 'POST', request as unknown as Record<string, unknown>)
  }

  async updateWallet(id: number, request: UpdateWalletRequest): Promise<UpdateWalletResponse> {
    return this.makeRequest<UpdateWalletResponse>(`/api/wallets/${id}`, 'PATCH', request as unknown as Record<string, unknown>)
  }

  async deleteWallets(request: DeleteWalletsRequest): Promise<DeleteWalletsResponse> {
    return this.makeRequest<DeleteWalletsResponse>('/api/wallets', 'DELETE', request as unknown as Record<string, unknown>)
  }
}

// Factory function to create Unpayments API instance
export function createUnpaymentsAPI(): UnpaymentsAPI {
  const baseUrl = process.env.UNPAYMENTS_BASE_URL
  const apiToken = process.env.UNPAYMENTS_API_KEY

  if (!baseUrl) {
    throw new Error('UNPAYMENTS_BASE_URL environment variable is required')
  }

  if (!apiToken) {
    throw new Error('UNPAYMENTS_API_KEY environment variable is required')
  }

  return new UnpaymentsAPI({
    baseUrl,
    apiToken,
    ipnWebhook: process.env.UNPAYMENTS_IPN_WEBHOOK
  })
}

export type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  ListPaymentsResponse,
  WebhookPayload
}
