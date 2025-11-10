import { z } from "zod";

/**
 * Server Creation Schema
 * Validates all inputs for creating a new server instance
 */
export const serverCreateSchema = z.object({
  hostname: z
    .string()
    .min(1, "Hostname is required")
    .max(255, "Hostname too long")
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/, "Hostname must contain only alphanumeric characters and hyphens, and cannot start or end with a hyphen"),
  region: z
    .string()
    .min(1, "Region is required")
    .max(50, "Invalid region"),
  image: z
    .string()
    .min(1, "Operating system image is required")
    .max(100, "Invalid image"),
  planType: z
    .string()
    .min(1, "Plan type is required")
    .regex(/^[a-z0-9-]+$/, "Invalid plan type format"),
  sshKeys: z
    .array(z.string().min(1, "SSH key cannot be empty"))
    .min(1, "At least one SSH key is required")
    .max(10, "Maximum 10 SSH keys allowed"),
  ownerId: z
    .string()
    .uuid("Invalid owner ID"),
  ownerEmail: z
    .string()
    .email("Invalid email address")
    .optional(),
});

export type ServerCreateInput = z.infer<typeof serverCreateSchema>;

/**
 * Server Power Action Schema
 * Validates power control actions (start, stop, reboot)
 */
export const serverPowerActionSchema = z.object({
  serverId: z
    .string()
    .uuid("Invalid server ID"),
  action: z
    .enum(["start", "stop", "reboot"])
    .refine((val) => ["start", "stop", "reboot"].includes(val), {
      message: "Action must be start, stop, or reboot",
    }),
});

export type ServerPowerActionInput = z.infer<typeof serverPowerActionSchema>;

/**
 * Server Delete Schema
 * Validates server deletion requests
 */
export const serverDeleteSchema = z.object({
  serverId: z
    .string()
    .uuid("Invalid server ID"),
});

export type ServerDeleteInput = z.infer<typeof serverDeleteSchema>;

/**
 * Server Rebuild Schema
 * Validates server rebuild requests
 */
export const serverRebuildSchema = z.object({
  serverId: z
    .string()
    .uuid("Invalid server ID"),
  image: z
    .string()
    .min(1, "Operating system image is required")
    .max(100, "Invalid image"),
  sshKeys: z
    .array(z.string().min(1))
    .min(1, "At least one SSH key is required")
    .max(10, "Maximum 10 SSH keys allowed")
    .optional(),
});

export type ServerRebuildInput = z.infer<typeof serverRebuildSchema>;

/**
 * Ticket Creation Schema
 * Validates support ticket creation
 */
export const ticketCreateSchema = z.object({
  subject: z
    .string()
    .min(5, "Subject must be at least 5 characters")
    .max(200, "Subject too long"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message too long"),
  priority: z
    .enum(["low", "medium", "high", "urgent"])
    .default("medium"),
});

export type TicketCreateInput = z.infer<typeof ticketCreateSchema>;

/**
 * Ticket Message Schema
 * Validates ticket message/reply creation
 */
export const ticketMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(5000, "Message too long"),
  isStaff: z
    .boolean()
    .default(false),
});

export type TicketMessageInput = z.infer<typeof ticketMessageSchema>;

/**
 * Ticket Update Schema
 * Validates ticket status updates
 */
export const ticketUpdateSchema = z.object({
  status: z
    .enum(["open", "in_progress", "waiting", "resolved", "closed"])
    .optional(),
  priority: z
    .enum(["low", "medium", "high", "urgent"])
    .optional(),
});

export type TicketUpdateInput = z.infer<typeof ticketUpdateSchema>;

/**
 * Crypto Payment Creation Schema
 * Validates cryptocurrency payment requests
 */
export const cryptoPaymentCreateSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be positive")
    .min(5, "Minimum payment is $5")
    .max(10000, "Maximum payment is $10,000"),
  currency: z
    .string()
    .length(3, "Currency must be 3 characters")
    .toUpperCase()
    .default("USD"),
});

export type CryptoPaymentCreateInput = z.infer<typeof cryptoPaymentCreateSchema>;

/**
 * Admin User Update Schema
 * Validates admin user modifications
 */
export const adminUserUpdateSchema = z.object({
  userId: z
    .string()
    .uuid("Invalid user ID"),
  email: z
    .string()
    .email("Invalid email address")
    .optional(),
  isAdmin: z
    .boolean()
    .optional(),
  isBanned: z
    .boolean()
    .optional(),
});

export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;

/**
 * Admin Pricing Update Schema
 * Validates pricing configuration updates
 */
export const adminPricingUpdateSchema = z.object({
  planType: z
    .string()
    .min(1, "Plan type is required"),
  basePrice: z
    .number()
    .positive("Base price must be positive")
    .optional(),
  markup: z
    .number()
    .min(0, "Markup cannot be negative")
    .max(100, "Markup cannot exceed 100%")
    .optional(),
  enabled: z
    .boolean()
    .optional(),
});

export type AdminPricingUpdateInput = z.infer<typeof adminPricingUpdateSchema>;

/**
 * Pagination Schema
 * Validates pagination parameters
 */
export const paginationSchema = z.object({
  page: z
    .number()
    .int()
    .positive()
    .default(1),
  limit: z
    .number()
    .int()
    .positive()
    .max(100, "Maximum 100 items per page")
    .default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * Query Parameter Coercion Helper
 * Converts string query parameters to expected types
 */
export const queryParamSchema = {
  string: (defaultValue?: string) =>
    z
      .string()
      .optional()
      .transform((val) => val ?? defaultValue),
  
  number: (defaultValue?: number) =>
    z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return defaultValue;
        const num = Number(val);
        return isNaN(num) ? defaultValue : num;
      }),
  
  boolean: (defaultValue?: boolean) =>
    z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return defaultValue;
        return val === "true" || val === "1";
      }),
  
  uuid: () =>
    z
      .string()
      .uuid("Invalid ID format"),
};

/**
 * Validation Helper
 * Provides consistent validation error handling
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; issues: z.ZodIssue[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return {
        success: false,
        error: firstIssue?.message || "Validation failed",
        issues: error.issues,
      };
    }
    return {
      success: false,
      error: "Validation failed",
      issues: [],
    };
  }
}

/**
 * Safe Parse Helper
 * Returns validated data or null with logged error
 */
export async function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): Promise<T | null> {
  const result = validateSchema(schema, data);
  if (isValidationError(result)) {
    console.error(`Validation error${context ? ` in ${context}` : ""}:`, {
      error: result.error,
      issues: result.issues,
    });
    return null;
  }
  return result.data;
}

/**
 * Type guard for validation results
 */
export function isValidationError<T>(
  result: { success: true; data: T } | { success: false; error: string; issues: z.ZodIssue[] }
): result is { success: false; error: string; issues: z.ZodIssue[] } {
  return !result.success;
}
