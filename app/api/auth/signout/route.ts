import { createClient } from "@/lib/supabase/server"

export async function POST() {
    try {
        const supabase = await createClient()
        const { error } = await supabase.auth.signOut()
        console.error(error)
        return new Response("ok")
    } catch {
        return new Response("error", { status: 500 })
    }
}