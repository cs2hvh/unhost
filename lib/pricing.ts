// Server pricing calculation utilities
import { LINODE_PLAN_TYPES, getLinodePlanCost } from './linode';

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

export function calculateHourlyCost(specs: ServerSpecs, pricing?: PricingTier): number {
  const { location, planType } = specs;

  if (!planType) {
    throw new Error('planType is required for Linode pricing');
  }

  const { hourly } = getLinodePlanCost(planType);
  let cost = hourly;

  // Apply location multiplier (currently all 1.0 for Linode)
  if (location && LOCATION_MULTIPLIERS[location]) {
    cost *= LOCATION_MULTIPLIERS[location];
  }

  return Math.round(cost * 10000) / 10000; // Round to 4 decimal places
}

export function calculateMonthlyCost(specs: ServerSpecs, pricing?: PricingTier): number {
  const { planType } = specs;

  // Use Linode monthly pricing if available
  if (planType) {
    const { monthly } = getLinodePlanCost(planType);
    const location = specs.location;
    let cost = monthly;

    if (location && LOCATION_MULTIPLIERS[location]) {
      cost *= LOCATION_MULTIPLIERS[location];
    }

    return Math.round(cost * 100) / 100;
  }

  const hourlyCost = calculateHourlyCost(specs, pricing);
  return Math.round(hourlyCost * 24 * 30 * 100) / 100; // Round to 2 decimal places
}

export function calculateCostForDuration(specs: ServerSpecs, hours: number, pricing?: PricingTier): number {
  const hourlyCost = calculateHourlyCost(specs, pricing);
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

export function getEstimatedRuntime(balance: number, specs: ServerSpecs, pricing?: PricingTier): number {
  const hourlyCost = calculateHourlyCost(specs, pricing);
  if (hourlyCost <= 0) return 0;
  return Math.floor(balance / hourlyCost);
}

export function canAffordServer(balance: number, specs: ServerSpecs, minHours: number = 1, pricing?: PricingTier): boolean {
  const hourlyCost = calculateHourlyCost(specs, pricing);
  const requiredAmount = hourlyCost * minHours;
  return balance >= requiredAmount;
}