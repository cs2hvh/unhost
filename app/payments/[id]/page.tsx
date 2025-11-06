import { notFound } from 'next/navigation'
import { createUnpaymentsAPI } from '@/lib/unpayments'
import PaymentClient from './payment-client'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

interface PaymentPageProps {
  params: Promise<{
    id: string
  }>
}

async function getPaymentData(paymentId: string) {
  try {
    const unpayments = createUnpaymentsAPI()
    const paymentData = await unpayments.getPaymentStatus(paymentId)
    console.log('Fetched payment data:', paymentData)
    return paymentData.data
  } catch (error) {
    console.error('Failed to fetch payment data:', error)
    return null
  }
}

function PaymentLoader() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>
  )
}

export default async function PaymentPage({ params }: PaymentPageProps) {
  const paymentData = await getPaymentData((await params).id)

  if (!paymentData) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<PaymentLoader />}>
        <PaymentClient initialPaymentData={paymentData} paymentId={(await params).id} />
      </Suspense>
    </div>
  )
}