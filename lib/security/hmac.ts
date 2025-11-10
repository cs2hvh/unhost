import crypto from "crypto";

/**
 * HMAC Request Signing for Critical Operations
 * Provides message authentication and integrity verification
 */

const HMAC_ALGORITHM = "sha256";
const SIGNATURE_HEADER = "x-signature";
const TIMESTAMP_HEADER = "x-timestamp";
const REQUEST_VALIDITY_WINDOW = 5 * 60 * 1000; // 5 minutes

/**
 * Get HMAC secret from environment
 * In production, this should be a strong secret key
 */
function getHMACSecret(): string {
  const secret = process.env.HMAC_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("HMAC_SECRET_KEY must be set in production");
    }
    // Development fallback
    return "development-hmac-secret-key-change-in-production";
  }
  return secret;
}

/**
 * Generate HMAC signature for request
 */
export function generateSignature(
  payload: string | Record<string, any>,
  timestamp: number
): string {
  const secret = getHMACSecret();
  const data = typeof payload === "string" ? payload : JSON.stringify(payload);
  const message = `${timestamp}.${data}`;

  return crypto
    .createHmac(HMAC_ALGORITHM, secret)
    .update(message)
    .digest("hex");
}

/**
 * Verify HMAC signature
 */
export function verifySignature(
  payload: string | Record<string, any>,
  timestamp: number,
  signature: string
): boolean {
  const expectedSignature = generateSignature(payload, timestamp);

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Check if timestamp is within acceptable range
 */
export function isTimestampValid(timestamp: number): boolean {
  const now = Date.now();
  const difference = Math.abs(now - timestamp);
  return difference < REQUEST_VALIDITY_WINDOW;
}

/**
 * Sign a request payload
 */
export interface SignedRequest {
  payload: any;
  timestamp: number;
  signature: string;
}

export function signRequest(payload: any): SignedRequest {
  const timestamp = Date.now();
  const signature = generateSignature(payload, timestamp);

  return {
    payload,
    timestamp,
    signature,
  };
}

/**
 * Verify a signed request
 */
export function verifyRequest(
  payload: any,
  timestamp: number,
  signature: string
): { valid: boolean; error?: string } {
  // Check timestamp validity
  if (!isTimestampValid(timestamp)) {
    return {
      valid: false,
      error: "Request timestamp is outside acceptable range",
    };
  }

  // Verify signature
  if (!verifySignature(payload, timestamp, signature)) {
    return {
      valid: false,
      error: "Invalid request signature",
    };
  }

  return { valid: true };
}

/**
 * Middleware to require HMAC signature on critical operations
 */
export function requireHMACSignature(
  handler: (request: Request) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    try {
      // Get headers
      const signature = request.headers.get(SIGNATURE_HEADER);
      const timestampStr = request.headers.get(TIMESTAMP_HEADER);

      if (!signature || !timestampStr) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Missing request signature or timestamp",
            code: "MISSING_SIGNATURE",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      const timestamp = parseInt(timestampStr, 10);
      if (isNaN(timestamp)) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Invalid timestamp format",
            code: "INVALID_TIMESTAMP",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Get request body
      const bodyText = await request.text();
      let payload: any;

      try {
        payload = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Invalid JSON payload",
            code: "INVALID_PAYLOAD",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Verify the request
      const verification = verifyRequest(payload, timestamp, signature);

      if (!verification.valid) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: verification.error || "Signature verification failed",
            code: "SIGNATURE_VERIFICATION_FAILED",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Create a new request with the parsed body
      const newRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: bodyText,
      });

      return handler(newRequest);
    } catch (error) {
      console.error("HMAC verification error:", error);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Internal server error during signature verification",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };
}

/**
 * Client-side helper to attach HMAC signature to requests
 */
export interface HMACClient {
  signAndSend: (
    url: string,
    options: RequestInit & { body?: any }
  ) => Promise<Response>;
}

export function createHMACClient(): HMACClient {
  return {
    signAndSend: async (url: string, options: RequestInit & { body?: any }) => {
      const payload = options.body || {};
      const { timestamp, signature } = signRequest(payload);

      const headers = new Headers(options.headers || {});
      headers.set(SIGNATURE_HEADER, signature);
      headers.set(TIMESTAMP_HEADER, timestamp.toString());
      headers.set("Content-Type", "application/json");

      return fetch(url, {
        ...options,
        headers,
        body: JSON.stringify(payload),
      });
    },
  };
}

/**
 * Generate webhook signature for outgoing webhooks
 */
export function generateWebhookSignature(
  payload: Record<string, any>,
  secret: string
): string {
  const timestamp = Date.now();
  const message = `${timestamp}.${JSON.stringify(payload)}`;

  return crypto
    .createHmac(HMAC_ALGORITHM, secret)
    .update(message)
    .digest("hex");
}

/**
 * Verify webhook signature from external services
 */
export function verifyWebhookSignature(
  payload: Record<string, any>,
  signature: string,
  timestamp: number,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac(HMAC_ALGORITHM, secret)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
