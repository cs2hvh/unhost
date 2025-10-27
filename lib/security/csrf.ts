import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Get CSRF token from request cookies
 */
export function getCSRFTokenFromCookie(request: NextRequest): string | null {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value || null;
}

/**
 * Get CSRF token from request headers
 */
export function getCSRFTokenFromHeader(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME) || null;
}

/**
 * Validate CSRF token
 * Compares the token from the cookie with the token from the header
 */
export function validateCSRFToken(request: NextRequest): boolean {
  const cookieToken = getCSRFTokenFromCookie(request);
  const headerToken = getCSRFTokenFromHeader(request);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );
}

/**
 * Middleware to require CSRF token for state-changing operations
 */
export function requireCSRFToken(handler: (req: NextRequest) => Promise<Response>) {
  return async (request: NextRequest): Promise<Response> => {
    const method = request.method.toUpperCase();

    // Only require CSRF for state-changing methods
    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      if (!validateCSRFToken(request)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Invalid or missing CSRF token",
            code: "CSRF_VALIDATION_FAILED",
          },
          { status: 403 }
        );
      }
    }

    return handler(request);
  };
}

/**
 * Create a response with a new CSRF token cookie
 */
export function setCSRFTokenCookie(response: NextResponse, token?: string): NextResponse {
  const csrfToken = token || generateCSRFToken();

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  // Also set in a header for client-side access
  response.headers.set("X-CSRF-Token", csrfToken);

  return response;
}

/**
 * API route to get a new CSRF token
 */
export async function GET(request: NextRequest) {
  const token = generateCSRFToken();
  const response = NextResponse.json({ token });
  return setCSRFTokenCookie(response, token);
}

/**
 * Hook for client-side CSRF token management
 */
export interface CSRFTokenManager {
  getToken: () => string | null;
  refreshToken: () => Promise<string>;
  attachToHeaders: (headers: HeadersInit) => HeadersInit;
}

/**
 * Get CSRF token manager for client-side use
 */
export function getCSRFTokenManager(): CSRFTokenManager {
  let cachedToken: string | null = null;

  return {
    getToken: () => {
      if (cachedToken) return cachedToken;

      // Try to get from cookie
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split("=");
        if (name === CSRF_COOKIE_NAME) {
          cachedToken = value;
          return value;
        }
      }

      return null;
    },

    refreshToken: async () => {
      const response = await fetch("/api/csrf", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to get CSRF token");
      }

      const data = await response.json();
      cachedToken = data.token;
      return data.token;
    },

    attachToHeaders: (headers: HeadersInit = {}) => {
      const token = cachedToken || getCSRFTokenManager().getToken();
      if (!token) {
        console.warn("CSRF token not available. Call refreshToken() first.");
        return headers;
      }

      return {
        ...headers,
        [CSRF_HEADER_NAME]: token,
      };
    },
  };
}
