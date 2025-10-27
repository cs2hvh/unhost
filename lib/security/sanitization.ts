/**
 * Security utilities for sanitizing errors and protecting sensitive information
 */

export interface SafeError {
  message: string;
  code?: string;
  statusCode?: number;
}

/**
 * List of error messages that should never be exposed to clients
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /credential/i,
  /authorization/i,
  /authentication/i,
  /session/i,
  /api[_-]?key/i,
  /database/i,
  /connection/i,
  /supabase/i,
  /postgres/i,
  /redis/i,
  /env/i,
  /process\.env/i,
  /\.env/i,
];

/**
 * Check if error message contains sensitive information
 */
function containsSensitiveInfo(message: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Sanitize error message for client response
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    if (containsSensitiveInfo(error)) {
      return "An internal error occurred. Please try again later.";
    }
    return error;
  }

  if (error instanceof Error) {
    if (containsSensitiveInfo(error.message)) {
      return "An internal error occurred. Please try again later.";
    }
    
    // Check for common error types
    if (error.name === "PostgrestError" || error.name === "SupabaseError") {
      return "Database operation failed. Please try again.";
    }

    if (error.name === "ZodError") {
      return "Invalid request data.";
    }

    return error.message;
  }

  return "An unexpected error occurred.";
}

/**
 * Create a safe error response for API routes
 */
export function createSafeErrorResponse(
  error: unknown,
  statusCode: number = 500,
  additionalContext?: Record<string, unknown>
): { ok: false; error: string; code?: string } {
  const message = sanitizeErrorMessage(error);

  // Log the full error server-side for debugging
  if (process.env.NODE_ENV !== "production") {
    console.error("Error details (dev only):", error);
  } else {
    // In production, log to error tracking service (e.g., Sentry)
    console.error("Error occurred:", {
      message,
      timestamp: new Date().toISOString(),
      ...additionalContext,
    });
  }

  return {
    ok: false,
    error: message,
    code: getErrorCode(error),
  };
}

/**
 * Extract error code from error object
 */
function getErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null) {
    const err = error as any;
    
    if (err.code) return String(err.code);
    if (err.statusCode) return `HTTP_${err.statusCode}`;
    if (err.name) return err.name.toUpperCase();
  }

  return undefined;
}

/**
 * Validate that database queries are parameterized
 * This is a development-time helper
 */
export function validateParameterizedQuery(query: string): boolean {
  // Check for common SQL injection patterns
  const dangerousPatterns = [
    /'\s*OR\s*'1'\s*=\s*'1/i,
    /--/,
    /;.*DROP/i,
    /;.*DELETE/i,
    /;.*INSERT/i,
    /;.*UPDATE/i,
    /UNION.*SELECT/i,
    /\$\{.*\}/,  // Template literal injection
    /\+\s*["'].*["']\s*\+/,  // String concatenation
  ];

  const hasDangerousPattern = dangerousPatterns.some((pattern) =>
    pattern.test(query)
  );

  if (hasDangerousPattern && process.env.NODE_ENV !== "production") {
    console.warn(
      "⚠️ Potentially unsafe SQL query detected:",
      query.substring(0, 100)
    );
  }

  return !hasDangerousPattern;
}

/**
 * Sanitize user input for safe database storage
 */
export function sanitizeInput(input: string): string {
  // Remove null bytes
  let sanitized = input.replace(/\0/g, "");

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Validate and sanitize hostname
 */
export function sanitizeHostname(hostname: string): string {
  // Remove any characters that aren't alphanumeric or hyphens
  let sanitized = hostname.toLowerCase().replace(/[^a-z0-9-]/g, "");

  // Remove leading/trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, "");

  // Limit length
  sanitized = sanitized.substring(0, 63);

  return sanitized;
}

/**
 * Sanitize email for safe storage
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Check if request origin is allowed (CORS helper)
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    "http://localhost:3000",
    "http://localhost:3001",
  ].filter(Boolean);

  return allowedOrigins.includes(origin);
}

/**
 * Rate limit key generator for different contexts
 */
export function getRateLimitKey(
  type: "auth" | "api" | "create" | "action",
  identifier: string
): string {
  return `ratelimit:${type}:${identifier}`;
}

/**
 * Mask sensitive data in logs
 */
export function maskSensitiveData(data: Record<string, any>): Record<string, any> {
  const masked = { ...data };
  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "key",
    "apiKey",
    "api_key",
    "accessToken",
    "access_token",
    "refreshToken",
    "refresh_token",
    "creditCard",
    "ssn",
  ];

  for (const key in masked) {
    if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      masked[key] = "***REDACTED***";
    }
  }

  return masked;
}
