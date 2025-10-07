import { generateToken } from "@/lib/utils";

export async function GET() {
    const token = generateToken()
    return Response.json({
        ok: true,
        message: 'API is working',
        token
    });
}