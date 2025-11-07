import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/serverAuth'
import { createUnpaymentsAPI } from '@/lib/unpayments'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser(request)
    if (auth.success === false) {
      return Response.json(
        { error: auth.message },
        { status: auth.status }
      )
    }

    const orderId = (await params).id

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Order ID is required'
      }, { status: 400 })
    }

    // Get payment status from Unpayments
    const unpayments = createUnpaymentsAPI()
    const paymentResponse = await unpayments.getPaymentStatus(orderId)

    if (!paymentResponse.success || !paymentResponse.data) {
      return NextResponse.json({
        success: false,
        error: 'Payment not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      payment: paymentResponse.data
    })

  } catch (error) {
    console.error('Failed to fetch payment status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payment status'
    }, { status: 500 })
  }
}