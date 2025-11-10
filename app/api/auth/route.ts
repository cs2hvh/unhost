import { authSchema } from '@/components/auth/schema'
import { createClient } from '@/lib/supabase/server'
import { signInOrCreateUser } from '@/lib/supabase/user'
import { rateLimit } from '@/lib/rateLimit'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/auth
 * Rate limited: 5 requests per minute per IP
 */
export async function POST(request: NextRequest) {
    try {
        // Apply rate limiting
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
        
        const rateLimitResult = rateLimit(`auth:${ip}`, 5, 60 * 1000); // 5 requests per minute
        
        if (!rateLimitResult.allowed) {
            return NextResponse.json(
                { 
                    error: 'Too many authentication attempts. Please try again later.',
                    retryAfter: (rateLimitResult as { allowed: false; retryAfter: number }).retryAfter
                },
                { 
                    status: 429,
                    headers: {
                        'Retry-After': String((rateLimitResult as { allowed: false; retryAfter: number }).retryAfter),
                        'X-RateLimit-Limit': '5',
                        'X-RateLimit-Remaining': '0',
                    }
                }
            );
        }

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
            { 
                status: 200,
                headers: {
                    'X-RateLimit-Limit': '5',
                    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                }
            }
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
