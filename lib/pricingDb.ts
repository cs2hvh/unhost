// Database-driven pricing utilities
import { createClient } from '@/lib/supabase/client';

interface PricingEntry {
  plan_id: string;
  hourly_price: number;
  monthly_price: number;
  is_active: boolean;
}

let cachedPricing: Map<string, PricingEntry> | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5000; // 5 seconds for faster updates

/**
 * Fetch pricing from database with caching
 */
export async function fetchPricing(): Promise<Map<string, PricingEntry>> {
  const now = Date.now();
  
  // Return cached pricing if still valid
  if (cachedPricing && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedPricing;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('server_pricing')
    .select('plan_id, hourly_price, monthly_price, is_active')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching pricing:', error);
    // Return empty map on error
    return new Map();
  }

  // Build map for quick lookup
  const pricingMap = new Map<string, PricingEntry>();
  (data || []).forEach(entry => {
    pricingMap.set(entry.plan_id, entry);
  });

  // Update cache
  cachedPricing = pricingMap;
  cacheTimestamp = now;

  return pricingMap;
}

/**
 * Get pricing for a specific plan
 */
export async function getPlanPricing(planId: string): Promise<{ hourly: number; monthly: number } | null> {
  const pricing = await fetchPricing();
  const entry = pricing.get(planId);
  
  if (!entry) {
    return null;
  }

  return {
    hourly: entry.hourly_price,
    monthly: entry.monthly_price
  };
}

/**
 * Clear pricing cache (useful after admin updates)
 */
export function clearPricingCache() {
  cachedPricing = null;
  cacheTimestamp = 0;
}
