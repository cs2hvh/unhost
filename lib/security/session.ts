import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Session security utilities
 */

/**
 * Rotate user session after privilege changes
 * Forces re-authentication to ensure security
 */
export async function rotateSession(
  userId: string,
  reason: "privilege_change" | "security_update" | "password_change"
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Sign out all sessions for this user
    const { error: signOutError } = await supabase.auth.admin.signOut(userId, "global");

    if (signOutError) {
      console.error("Session rotation failed:", signOutError);
      return { success: false, error: signOutError.message };
    }

    // Log the session rotation
    await logSecurityEvent(userId, "session_rotation", { reason });

    return { success: true };
  } catch (error) {
    console.error("Session rotation error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Validate session and check for required rotation
 */
export async function validateSession(
  userId: string
): Promise<{ valid: boolean; requiresRotation: boolean; reason?: string }> {
  try {
    const supabase = await createClient();

    // Get user metadata
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !userData.user) {
      return { valid: false, requiresRotation: false };
    }

    const user = userData.user;

    // Check if user privileges have changed recently
    const lastPrivilegeChange = user.user_metadata?.last_privilege_change as string | undefined;
    const lastSignIn = user.last_sign_in_at;

    if (lastPrivilegeChange && lastSignIn) {
      const privilegeChangeTime = new Date(lastPrivilegeChange).getTime();
      const signInTime = new Date(lastSignIn).getTime();

      // If privilege changed after last sign-in, require rotation
      if (privilegeChangeTime > signInTime) {
        return {
          valid: true,
          requiresRotation: true,
          reason: "Privilege change detected",
        };
      }
    }

    return { valid: true, requiresRotation: false };
  } catch (error) {
    console.error("Session validation error:", error);
    return { valid: false, requiresRotation: false };
  }
}

/**
 * Update user privileges and trigger session rotation
 */
export async function updateUserPrivileges(
  userId: string,
  isAdmin: boolean,
  performedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Update user metadata
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        is_admin: isAdmin,
        last_privilege_change: new Date().toISOString(),
        privilege_changed_by: performedBy,
      },
    });

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log the privilege change
    await logSecurityEvent(userId, "privilege_change", {
      isAdmin,
      performedBy,
      timestamp: new Date().toISOString(),
    });

    // Rotate the session to force re-authentication
    const rotationResult = await rotateSession(userId, "privilege_change");

    if (!rotationResult.success) {
      console.error("Failed to rotate session after privilege change");
      // Continue anyway - privilege was updated
    }

    return { success: true };
  } catch (error) {
    console.error("Update privileges error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Log security events for audit trail
 */
async function logSecurityEvent(
  userId: string,
  eventType: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    const supabase = await createClient();

    // You can create a security_events table or use existing audit log
    const { error } = await supabase.from("security_events").insert({
      user_id: userId,
      event_type: eventType,
      metadata,
      timestamp: new Date().toISOString(),
      ip_address: metadata.ip_address || null,
    });

    if (error) {
      // If table doesn't exist, just log to console
      console.log("Security event:", { userId, eventType, metadata });
    }
  } catch (error) {
    console.error("Failed to log security event:", error);
  }
}

/**
 * Check if session is expired or about to expire
 */
export function isSessionExpiringSoon(expiresAt: number): boolean {
  const now = Date.now() / 1000; // Convert to seconds
  const timeUntilExpiry = expiresAt - now;
  const fifteenMinutes = 15 * 60; // 15 minutes in seconds

  return timeUntilExpiry < fifteenMinutes;
}

/**
 * Refresh session token if needed
 */
export async function refreshSessionIfNeeded(
  supabase: SupabaseClient
): Promise<{ refreshed: boolean; error?: string }> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return { refreshed: false, error: sessionError?.message || "No active session" };
    }

    if (isSessionExpiringSoon(session.expires_at || 0)) {
      const { error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        return { refreshed: false, error: refreshError.message };
      }

      return { refreshed: true };
    }

    return { refreshed: false }; // No refresh needed
  } catch (error) {
    console.error("Session refresh error:", error);
    return {
      refreshed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create session middleware for API routes
 */
export function createSessionMiddleware(
  handler: (request: Request) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        return new Response(
          JSON.stringify({ ok: false, error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check if session needs rotation
      const validation = await validateSession(user.id);

      if (validation.requiresRotation) {
        await rotateSession(user.id, "privilege_change");
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Session expired due to security update. Please sign in again.",
            code: "SESSION_ROTATION_REQUIRED",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      return handler(request);
    } catch (error) {
      console.error("Session middleware error:", error);
      return new Response(
        JSON.stringify({ ok: false, error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };
}
