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
            // console.error('Failed to Authenticate')
            toast.error("Failed to Authenticate. Please try again later.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <div>
                <AuthInput
                    value={tokenValue}
                    onChange={(newToken) => setValue("token", newToken)}
                />
                {errors.token && (
                    <p className="text-red-500 text-sm mt-1">{errors.token.message}</p>
                )}
            </div>

            <Button
                type="submit"
                className="w-full mt-4 cursor-pointer"
                disabled={isLoading}
            >
                {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <LogIn className="h-4 w-4" />}
                Authenticate
            </Button>
        </form>
    )
}