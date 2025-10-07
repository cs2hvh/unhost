import { z } from "zod"

export const authSchema = z.object({
    token: z.string()
        .trim()
        .regex(/^\d{4}-[A-F0-9]{8}-[A-F0-9]{4}$/, "Invalid token")
})

export type AuthFormData = z.infer<typeof authSchema>