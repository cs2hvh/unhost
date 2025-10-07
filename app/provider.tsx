'use client'

import { User } from '@/lib/supabase/types'
import { createContext, useContext, useState } from 'react'

type AuthContextType = {
    user: User | null
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({
    children,
    initialUser
}: {
    children: React.ReactNode
    initialUser: User | null
}) {
    const [user, setUser] = useState<User | null>(initialUser)

    const signOut = async () => {
        // Call your sign out API endpoint
        await fetch('/api/auth/signout', { method: 'POST' })
        setUser(null)
        window.location.href = '/auth'
    }

    return (
        <AuthContext.Provider value={{ user, signOut }}>
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