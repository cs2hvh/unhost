// CPU Types management utilities
import { createClient } from '@/lib/supabase/server'
import { LINODE_PLAN_CATEGORIES } from './linode'

export interface CPUType {
  id: string
  plan_category: string
  cpu_name: string
  cpu_description?: string | null
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

// In-memory cache for CPU types
let cpuTypesCache: Map<string, CPUType[]> | null = null // Changed to array of CPUs per category
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch CPU types from database with caching
 * Returns a Map where key = category, value = array of CPUs for that category
 */
export async function fetchCPUTypes(): Promise<Map<string, CPUType[]>> {
  const now = Date.now()

  // Return cached data if valid
  if (cpuTypesCache && now - cacheTimestamp < CACHE_DURATION) {
    return cpuTypesCache
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cpu_types')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching CPU types:', error)
      return getDefaultCPUTypes()
    }

    if (!data || data.length === 0) {
      return getDefaultCPUTypes()
    }

    // Build map: category -> array of CPUs
    const map = new Map<string, CPUType[]>()
    data.forEach((cpuType: CPUType) => {
      if (!map.has(cpuType.plan_category)) {
        map.set(cpuType.plan_category, [])
      }
      map.get(cpuType.plan_category)!.push(cpuType)
    })

    // Update cache
    cpuTypesCache = map
    cacheTimestamp = now

    return map
  } catch (error) {
    console.error('Error in fetchCPUTypes:', error)
    return getDefaultCPUTypes()
  }
}

/**
 * Get all CPUs for a specific category
 */
export async function getCPUsForCategory(category: string): Promise<CPUType[]> {
  const cpuTypes = await fetchCPUTypes()
  return cpuTypes.get(category) || []
}

/**
 * Get first CPU name for a category (for backward compatibility)
 */
export async function getCPUName(category: string): Promise<string> {
  const cpus = await getCPUsForCategory(category)
  
  if (cpus.length > 0) {
    return cpus[0].cpu_name
  }

  // Fallback to default
  const categoryInfo = LINODE_PLAN_CATEGORIES[category as keyof typeof LINODE_PLAN_CATEGORIES]
  return categoryInfo?.defaultCpu || 'Unknown CPU'
}

/**
 * Get default CPU types (fallback when DB is empty)
 */
function getDefaultCPUTypes(): Map<string, CPUType[]> {
  const map = new Map<string, CPUType[]>()
  
  Object.entries(LINODE_PLAN_CATEGORIES).forEach(([category, info]) => {
    map.set(category, [{
      id: `default-${category}`,
      plan_category: category,
      cpu_name: info.defaultCpu,
      cpu_description: `${info.label} instances`,
      is_active: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
  })

  return map
}

/**
 * Clear CPU types cache (call after updates)
 */
export function clearCPUTypesCache(): void {
  cpuTypesCache = null
  cacheTimestamp = 0
}

/**
 * Get CPU type by ID
 */
export async function getCPUTypeById(id: string): Promise<CPUType | null> {
  const cpuTypes = await fetchCPUTypes()
  for (const cpus of cpuTypes.values()) {
    const cpu = cpus.find(c => c.id === id)
    if (cpu) return cpu
  }
  return null
}

/**
 * Get all CPU types as flat array
 */
export async function getAllCPUTypes(): Promise<CPUType[]> {
  const cpuTypes = await fetchCPUTypes()
  const allCpus: CPUType[] = []
  cpuTypes.forEach(cpus => allCpus.push(...cpus))
  return allCpus
}
