import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { User, UserRole } from "./supabase/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function hasRole(user: User | null, role: UserRole): boolean {
  return user?.roles.includes(role) || false
}

export function hasAnyRole(user: User | null, roles: UserRole[]): boolean {
  return user?.roles.some(userRole => roles.includes(userRole)) || false
}

export function isAdmin(user: User | null): boolean {
  // Check if user has admin role OR is the specific admin user
  // The token is stored in the email as {token}@example.com
  const ADMIN_TOKEN = '2510-b8beb268-5150';
  const adminEmail = `${ADMIN_TOKEN}@example.com`;

  return user?.email === adminEmail || hasRole(user, 'admin');
}

export function generateToken(): string {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `${year}${month}`

  const randomSegment1 = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')
  const randomSegment2 = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')

  return `${prefix}-${randomSegment1}-${randomSegment2}`
}