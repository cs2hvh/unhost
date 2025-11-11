import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/cpu-types - List all active CPU types (public access)
export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all active CPU types
    const { data: cpuTypes, error } = await supabase
      .from('cpu_types')
      .select('*')
      .eq('is_active', true)
      .order('plan_category', { ascending: true })
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching CPU types:', error)
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch CPU types' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, cpuTypes: cpuTypes || [] })
  } catch (error) {
    console.error('Error in GET /api/cpu-types:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
