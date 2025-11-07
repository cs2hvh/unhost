"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Copy, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import Image from "next/image"
import QRCode from "qrcode"
import toast from "react-hot-toast"

interface PaymentData {
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

interface PaymentClientProps {
  initialPaymentData: PaymentData
  paymentId: string
}

export default function PaymentClient({ initialPaymentData, paymentId }: PaymentClientProps) {
  const [paymentData, setPaymentData] = useState<PaymentData>(initialPaymentData)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [refreshing, setRefreshing] = useState(false)

  // Generate QR code
  useEffect(() => {
    const generateQR = async () => {
      if (paymentData.address) {
        try {
          const qrUrl = await QRCode.toDataURL(paymentData.address, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          })
          setQrCodeUrl(qrUrl)
        } catch {
          console.error('Failed to generate QR code')
        }
      }
    }
    generateQR()
  }, [paymentData.address])

  // Auto-refresh every minute
  useEffect(() => {
    const fetchPaymentData = async () => {
      try {
        setRefreshing(true)
        const response = await fetch(`/api/crypto/payment/${paymentId}`)
        const data = await response.json()

        if (response.ok && data.success) {
          setPaymentData(data.payment)
        }
      } catch {
        console.error('Failed to refresh payment data')
      } finally {
        setRefreshing(false)
      }
    }

    // Set up interval for auto-refresh
    const interval = setInterval(fetchPaymentData, 60000) // 1 minute

    return () => clearInterval(interval)
  }, [paymentId])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'border-green-500'
      case 'confirming':
        return 'border-blue-500'
      case 'waiting':
        return 'border-yellow-500'
      case 'partially_paid':
        return 'border-orange-500'
      case 'overpaid':
        return 'border-purple-500'
      case 'expired':
        return 'border-red-500'
      default:
        return 'border-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4" />
      case 'confirming':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'waiting':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'partially_paid':
        return <AlertCircle className="h-4 w-4" />
      case 'overpaid':
        return <AlertCircle className="h-4 w-4" />
      case 'expired':
        return <XCircle className="h-4 w-4" />
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />
    }
  }

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount)
    // Convert to string to preserve precision
    let str = num.toString()

    // Remove trailing zeros after decimal point
    if (str.includes('.')) {
      str = str.replace(/0+$/, '') // Remove trailing zeros
      str = str.replace(/\.$/, '') // Remove trailing decimal point if no digits after
    }

    return str
  }

  const getStatusDescription = (status: string) => {
    switch (status.toLowerCase()) {
      case 'waiting':
        return 'Waiting for payment to be received'
      case 'confirming':
        return 'Payment received, waiting for blockchain confirmations'
      case 'partially_paid':
        return 'Partial payment received - please send the remaining amount'
      case 'confirmed':
        return 'Payment confirmed and added to your wallet balance'
      case 'overpaid':
        return 'Payment confirmed - you sent more than expected'
      case 'expired':
        return 'Payment window expired, please create a new payment'
      default:
        return 'Unknown status'
    }
  }

  const isPaymentActive = !['confirmed', 'overpaid', 'expired'].includes(paymentData.status.toLowerCase())

  return (
    <div className="min-h-screen bg-zinc-950 text-white pt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-1">Crypto Payment</h1>
              <p className="text-zinc-400 text-sm">Order ID: {paymentData.order_id}</p>
            </div>
            <Badge variant="outline" className={`${getStatusColor(paymentData.status)} text-sm px-4 py-2 rounded-full border-2`}>
              <span className="flex items-center gap-2">
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  getStatusIcon(paymentData.status)
                )}
                {paymentData.status.toLowerCase() === 'overpaid' ? 'PAID' : paymentData.status.replace('_', ' ').toUpperCase()}
              </span>
            </Badge>
          </div>

          {/* Payment Details - Only show if payment is still active */}
          {isPaymentActive && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
              {/* Left Side - QR Code */}
              <div className="lg:col-span-2">
                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-8 sticky top-24">
                  <div className="flex flex-col items-center">
                    <div className="bg-white p-4 rounded-xl mb-4">
                      {qrCodeUrl ? (
                        <Image
                          src={qrCodeUrl}
                          alt="Payment QR Code"
                          width={256}
                          height={256}
                          className="w-64 h-64"
                        />
                      ) : (
                        <div className="w-64 h-64 flex items-center justify-center">
                          <Loader2 className="h-12 w-12 animate-spin text-zinc-400" />
                        </div>
                      )}
                    </div>
                    <p className="text-zinc-400 text-sm text-center mb-6">
                      Scan with your crypto wallet
                    </p>

                    {/* Amount Display */}
                    <div className="w-full bg-zinc-800/50 rounded-xl border border-zinc-700 p-4 text-center">
                      <p className="text-zinc-400 text-xs mb-1">Send Exactly</p>
                      <p className="text-3xl font-bold font-mono text-white mb-1">
                        {formatAmount(paymentData.amount_expected)}
                      </p>
                      <p className="text-xl font-semibold text-zinc-300">
                        {paymentData.currency.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side - Payment Details */}
              <div className="lg:col-span-3 space-y-6">
                {/* Payment Address Card */}
                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6">
                  <h3 className="text-lg font-semibold mb-4">Payment Address</h3>
                  <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <code className="text-sm font-mono break-all text-white flex-1">
                        {paymentData.address}
                      </code>
                    </div>
                    <Button
                      onClick={() => copyToClipboard(paymentData.address, 'Address')}
                      className="w-full bg-zinc-700 hover:bg-zinc-600 text-white"
                      size="lg"
                    >
                      <Copy className="h-4 w-4" />
                      Copy Address
                    </Button>
                  </div>
                </div>

                {/* Payment Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Network */}
                  <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
                    <p className="text-zinc-400 text-sm mb-2">Network</p>
                    <p className="text-xl font-bold text-white">
                      {paymentData.currency.includes('_')
                        ? paymentData.currency.split('_')[1]
                        : paymentData.currency.toUpperCase()}
                    </p>
                  </div>

                  {/* Confirmations */}
                  <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
                    <p className="text-zinc-400 text-sm mb-2">Confirmations Required</p>
                    <p className="text-xl font-bold text-white">
                      {paymentData.confirmations_required}
                    </p>
                  </div>

                  {/* Expiration */}
                  {paymentData.expires_at && (
                    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5 sm:col-span-2">
                      <p className="text-zinc-400 text-sm mb-2">Expires At</p>
                      <p className="text-lg font-bold text-orange-400">
                        {new Date(paymentData.expires_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="bg-blue-950/30 rounded-xl border border-blue-800/50 p-6">
                  <h3 className="text-lg font-semibold text-blue-300 mb-4">How to Pay</h3>
                  <ol className="space-y-3 text-sm text-blue-200">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">1</span>
                      <span>Copy the payment address or scan the QR code with your wallet</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">2</span>
                      <span>Send <strong className="text-white">{formatAmount(paymentData.amount_expected)} {paymentData.currency.toUpperCase()}</strong> to the address</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">3</span>
                      <span>Wait for {paymentData.confirmations_required} confirmations (usually 10-30 minutes)</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">4</span>
                      <span>Your wallet will be credited automatically once confirmed</span>
                    </li>
                  </ol>
                </div>

                {/* Warning */}
                <div className="bg-orange-950/30 rounded-xl border border-orange-800/50 p-6">
                  <h3 className="text-lg font-semibold text-orange-300 mb-3">Important Notes</h3>
                  <ul className="space-y-2 text-sm text-orange-200">
                    <li className="flex gap-2">
                      <span className="text-orange-400">•</span>
                      <span>Send the <strong>exact amount</strong> shown above</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-orange-400">•</span>
                      <span>Use the correct network: <strong>{paymentData.currency.includes('_') ? paymentData.currency.split('_')[1] : paymentData.currency.toUpperCase()}</strong></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-orange-400">•</span>
                      <span>Double-check the address before sending</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-orange-400">•</span>
                      <span>Send in a <strong>single transaction</strong> - multiple transactions to the same address may not be processed correctly</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-orange-400">•</span>
                      <span>Payment will expire if not received in time</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Payment Complete/Failed Status */}
          {!isPaymentActive && (
            <div className={`${paymentData.status === 'confirmed' || paymentData.status === 'overpaid'
              ? 'bg-green-950/30 border-green-800/50'
              : 'bg-red-950/30 border-red-800/50'
              } border rounded-2xl p-8 text-center`}>
              <div className="flex justify-center mb-4">
                {paymentData.status === 'confirmed' || paymentData.status === 'overpaid' ? (
                  <CheckCircle className="h-16 w-16 text-green-400" />
                ) : (
                  <XCircle className="h-16 w-16 text-red-400" />
                )}
              </div>
              <h3 className={`text-2xl font-bold mb-2 ${paymentData.status === 'confirmed' || paymentData.status === 'overpaid'
                ? 'text-green-300'
                : 'text-red-300'
                }`}>
                Payment {paymentData.status === 'confirmed' || paymentData.status === 'overpaid' ? 'Completed' : 'Ended'}
              </h3>
              <p className={`text-lg ${paymentData.status === 'confirmed' || paymentData.status === 'overpaid'
                ? 'text-green-200'
                : 'text-red-200'
                }`}>
                {getStatusDescription(paymentData.status)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}