import { NextRequest, NextResponse } from "next/server";
import { generateCSRFToken, setCSRFTokenCookie } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";

/**
 * GET /api/csrf
 * Returns a new CSRF token for the client
 */
export async function GET(request: NextRequest) {
  const token = generateCSRFToken();
  const response = NextResponse.json({ 
    ok: true,
    token,
    message: "CSRF token generated successfully"
  });
  
  return setCSRFTokenCookie(response, token);
}
