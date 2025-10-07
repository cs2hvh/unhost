import { authSchema } from '@/components/auth/schema'
import { createClient } from '@/lib/supabase/server'
import { signInOrCreateUser } from '@/lib/supabase/user'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/auth
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const validatedData = authSchema.parse(body)
        const supabase = await createClient()

        const email = `${validatedData.token}@example.com`
        const password = validatedData.token

        // Sign in or create user if not exist
        const data = await signInOrCreateUser(supabase, email, password)

        if (!data?.user) {
            return NextResponse.json(
                { error: 'Authentication failed' },
                { status: 401 }
            )
        }

        return NextResponse.json(
            {
                message: 'Authenticated successfully',
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    username: data.user.user_metadata?.username,
                },
            },
            { status: 200 }
        )
    } catch (error) {
        console.error('Signin API error:', error)

        // Handle zod validation errors
        if (error instanceof Error && 'issues' in error) {
            return NextResponse.json(
                { error: 'Invalid request data', details: error },
                { status: 400 }
            )
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
