
import Image from "next/image"
import Link from "next/link"
import { getUserFromHeaders } from '@/lib/supabase/user'
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth";
import { generateToken } from "@/lib/utils";

export default async function SignInPage() {
    const user = await getUserFromHeaders();

    if (user) {
        redirect('/dashboard')
    }
    const token = generateToken();
    return (
        <div className="flex min-h-screen items-center justify-center p-6 bg-background">
            <div className="w-full max-w-md space-y-8">
                {/* Header */}
                <div className="flex justify-center">
                    <Link href="/" className="group transition-all">
                        <div className='font-bold text-2xl tracking-tight text-foreground'>
                            Un<span className="text-foreground/70">Host</span>
                        </div>
                    </Link>
                </div>

                {/* Welcome Section */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        Welcome Back
                    </h1>
                </div>

                {/* Auth Form */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <AuthForm token={token} />
                </div>

                {/* Footer */}
                <div className="text-center text-sm text-muted-foreground">
                    <p>© 2025 UnHost. All rights reserved.</p>
                </div>
            </div>
        </div>
    )
}