'use client'

import { User } from '@/lib/supabase/types'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type AuthContextType = {
    user: User | null
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        // Get initial session
        const getUser = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()

                if (session?.user) {
                    setUser({
                        id: session.user.id,
                        email: session.user.email || '',
                        username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || '',
                        roles: session.user.user_metadata?.roles || ['user'],
                    })
                } else {
                    setUser(null)
                }
            } catch (error) {
                console.error('Error getting user:', error)
                setUser(null)
            } finally {
                setLoading(false)
            }
        }

        getUser()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (session?.user) {
                    setUser({
                        id: session.user.id,
                        email: session.user.email || '',
                        username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || '',
                        roles: session.user.user_metadata?.roles || ['user'],
                    })
                } else {
                    setUser(null)
                }
                setLoading(false)
            }
        )

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const signOut = async () => {
        try {
            await supabase.auth.signOut()
            setUser(null)
            window.location.href = '/auth'
        } catch (error) {
            console.error('Error signing out:', error)
        }
    }

    return (
        <AuthContext.Provider value={{ user, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}