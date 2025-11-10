"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { AuthFormData, authSchema } from "./schema"
import { Loader2, LogIn } from "lucide-react"
import AuthInput from "@/components/ui/authinput"

export function AuthForm({ token }: { token: string }) {
    const [isLoading, setIsLoading] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch
    } = useForm<AuthFormData>({
        resolver: zodResolver(authSchema),
        defaultValues: {
            token: token
        }
    })

    const tokenValue = watch("token")

    const onSubmit = async (data: AuthFormData) => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: data.token,
                }),
            })

            if (response.ok) {
                toast.success("Signed in successfully. Welcome back!")
                window.location.href = '/dashboard'
            } else {
                const error = await response.json()
                toast.error(error.error)
            }
        } catch {
            toast.error("Failed to Authenticate. Please try again later.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                    Authentication Token
                </label>
                <AuthInput
                    value={tokenValue}
                    onChange={(newToken) => setValue("token", newToken)}
                />
                {errors.token && (
                    <p className="text-red-500 text-sm mt-2">
                        {errors.token.message}
                    </p>
                )}
            </div>

            <Button
                type="submit"
                className="w-full h-11 font-medium cursor-pointer"
                disabled={isLoading}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                        Authenticating...
                    </>
                ) : (
                    <>
                        <LogIn className="w-4 h-4 mr-2" />
                        Sign In
                    </>
                )}
            </Button>
        </form>
    )
}