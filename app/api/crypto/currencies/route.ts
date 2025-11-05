import { NextResponse } from 'next/server'
import { createUnpaymentsAPI } from '@/lib/unpayments'

export async function GET() {
    try {
        const unpayments = createUnpaymentsAPI()
        const currencies = unpayments.getSupportedCurrencies()

        // Return currencies with their confirmation requirements
        const currencyDetails = currencies.map(code => ({
            code,
            confirmations_required: unpayments.getConfirmationsRequired(code)
        }))

        return NextResponse.json({
            success: true,
            currencies: currencyDetails
        })

    } catch (error) {
        console.error('Error fetching Unpayments currencies:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch currencies'
        }, { status: 500 })
    }
}