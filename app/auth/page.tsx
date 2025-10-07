
import Image from "next/image"
import Link from "next/link"
import { getUserFromHeaders } from '@/lib/supabase/user'
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth";
import { generateToken } from "@/lib/utils";

export default async function SignInPage() {
    const user = await getUserFromHeaders();

    if (user) {
        // console.log(user)
        redirect('/dashboard')
    }
    const token = generateToken();
    return (
        <div className="grid min-h-svh lg:grid-cols-2">
            {/* Left side - Form */}
            <div className="flex flex-col gap-4 p-6 md:p-10">
                <div className="flex justify-center gap-2 md:justify-start">
                    <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
                        <Image
                            src="/img/logo.png"
                            alt="Logo"
                            width={32}
                            height={32}
                            style={{ width: "auto", height: "auto" }}
                            className="rounded-md"
                        />
                        <div className='font-bold text-xl'>
                            Un<span className="text-primary hover:text-primary/90 transition-colors">Host</span>
                        </div>
                    </Link>
                </div>
                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-xs">
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-bold">Welcome Back</h1>
                            <p className="text-muted-foreground mt-2">
                                Sign in to your UnHost account
                            </p>
                        </div>
                        <AuthForm token={token} />
                    </div>
                </div>
            </div>

            {/* Right side - Background Image */}
            <div className="hidden lg:block relative overflow-hidden">
                <Image
                    src="/img/authbg.jpg"
                    alt="Background"
                    fill
                    className="object-cover transition-transform hover:scale-105 duration-700"
                    priority
                    style={{ filter: 'brightness(0.3) saturate(0.3) hue-rotate(180deg) contrast(1.2)' }}
                />
            </div>
        </div>
    )
}