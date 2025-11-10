// Server pricing calculation utilities
import { LINODE_PLAN_TYPES, getLinodePlanCost } from './linode';
import { getPlanPricing } from './pricingDb';

export interface ServerSpecs {
  planType: string; // Linode plan type (e.g., g6-standard-2) - REQUIRED
  location?: string;
  // Legacy fields (not used with Linode)
  cpuCores?: number;
  memoryGB?: number;
  diskGB?: number;
}

export interface PricingTier {
  cpu_per_core: number;
  memory_per_gb: number;
  disk_per_gb: number;
  base_cost: number;
}

// Linode uses fixed plan pricing
// Location-based pricing multipliers for Linode regions
const LOCATION_MULTIPLIERS: Record<string, number> = {
  'us-east': 1.0,           // Newark, NJ - Base price
  'us-central': 1.0,        // Dallas, TX
  'us-west': 1.0,           // Fremont, CA
  'us-southeast': 1.0,      // Atlanta, GA
  'ca-central': 1.0,        // Toronto, Canada
  'eu-west': 1.0,           // London, UK
  'eu-central': 1.0,        // Frankfurt, Germany
  'ap-south': 1.0,          // Singapore
  'ap-northeast': 1.0,      // Tokyo, Japan
  'ap-southeast': 1.0,      // Sydney, Australia
};

export async function calculateHourlyCost(specs: ServerSpecs, pricing?: PricingTier): Promise<number> {
  const { location, planType } = specs;

  if (!planType) {
    throw new Error('planType is required for Linode pricing');
  }

  // Try to get pricing from database first
  const dbPricing = await getPlanPricing(planType);
  let cost: number;

  if (dbPricing) {
    cost = dbPricing.hourly;
  } else {
    // Fall back to static pricing from linode.ts
    const { hourly } = getLinodePlanCost(planType);
    cost = hourly;
  }

  // Apply location multiplier (currently all 1.0 for Linode)
  if (location && LOCATION_MULTIPLIERS[location]) {
    cost *= LOCATION_MULTIPLIERS[location];
  }

  return Math.round(cost * 10000) / 10000; // Round to 4 decimal places
}

export async function calculateMonthlyCost(specs: ServerSpecs, pricing?: PricingTier): Promise<number> {
  const { planType } = specs;

  // Use pricing from database if available
  if (planType) {
    const dbPricing = await getPlanPricing(planType);
    if (dbPricing) {
      const location = specs.location;
      let cost = dbPricing.monthly;

      if (location && LOCATION_MULTIPLIERS[location]) {
        cost *= LOCATION_MULTIPLIERS[location];
      }

      return Math.round(cost * 100) / 100;
    }

    // Fall back to static pricing
    const { monthly } = getLinodePlanCost(planType);
    const location = specs.location;
    let cost = monthly;

    if (location && LOCATION_MULTIPLIERS[location]) {
      cost *= LOCATION_MULTIPLIERS[location];
    }

    return Math.round(cost * 100) / 100;
  }

  const hourlyCost = await calculateHourlyCost(specs, pricing);
  return Math.round(hourlyCost * 24 * 30 * 100) / 100; // Round to 2 decimal places
}

export async function calculateCostForDuration(specs: ServerSpecs, hours: number, pricing?: PricingTier): Promise<number> {
  const hourlyCost = await calculateHourlyCost(specs, pricing);
  return Math.round(hourlyCost * hours * 100) / 100; // Round to 2 decimal places
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(amount);
}

export async function getEstimatedRuntime(balance: number, specs: ServerSpecs, pricing?: PricingTier): Promise<number> {
  const hourlyCost = await calculateHourlyCost(specs, pricing);
  if (hourlyCost <= 0) return 0;
  return Math.floor(balance / hourlyCost);
}

export async function canAffordServer(balance: number, specs: ServerSpecs, minHours: number = 1, pricing?: PricingTier): Promise<boolean> {
  const hourlyCost = await calculateHourlyCost(specs, pricing);
  const requiredAmount = hourlyCost * minHours;
  return balance >= requiredAmount;
}