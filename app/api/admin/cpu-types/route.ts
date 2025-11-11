import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '../_utils'

// GET /api/admin/cpu-types - List all CPU types
export async function GET(req: NextRequest) {
  try {
    // Check admin authentication
    const auth = await requireAdmin(req)
    if (!auth.ok || !auth.isAdmin) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const supabase = await createClient()

    // Fetch all CPU types
    const { data: cpuTypes, error } = await supabase
      .from('cpu_types')
      .select('*')
      .order('plan_category', { ascending: true })

    if (error) {
      console.error('Error fetching CPU types:', error)
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch CPU types' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, cpuTypes })
  } catch (error) {
    console.error('Error in GET /api/admin/cpu-types:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/cpu-types - Update a CPU type
export async function PUT(req: NextRequest) {
  try {
    // Check admin authentication
    const auth = await requireAdmin(req)
    if (!auth.ok || !auth.isAdmin) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const supabase = await createClient()

    const body = await req.json()
    const { plan_category, cpu_name, cpu_description } = body

    if (!plan_category || !cpu_name) {
      return NextResponse.json(
        { ok: false, error: 'plan_category and cpu_name are required' },
        { status: 400 }
      )
    }

    // Update the CPU type
    const { data: cpuType, error } = await supabase
      .from('cpu_types')
      .update({
        cpu_name,
        cpu_description: cpu_description || null,
      })
      .eq('plan_category', plan_category)
      .select()
      .single()

    if (error) {
      console.error('Error updating CPU type:', error)
      return NextResponse.json(
        { ok: false, error: 'Failed to update CPU type' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, cpuType })
  } catch (error) {
    console.error('Error in PUT /api/admin/cpu-types:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/cpu-types - Create a new CPU type
export async function POST(req: NextRequest) {
  try {
    // Check admin authentication
    const auth = await requireAdmin(req)
    if (!auth.ok || !auth.isAdmin) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const supabase = await createClient()

    const body = await req.json()
    const { plan_category, cpu_name, cpu_description } = body

    if (!plan_category || !cpu_name) {
      return NextResponse.json(
        { ok: false, error: 'plan_category and cpu_name are required' },
        { status: 400 }
      )
    }

    // Insert new CPU type
    const { data: cpuType, error } = await supabase
      .from('cpu_types')
      .insert({
        plan_category,
        cpu_name,
        cpu_description: cpu_description || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating CPU type:', error)
      return NextResponse.json(
        { ok: false, error: 'Failed to create CPU type' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, cpuType })
  } catch (error) {
    console.error('Error in POST /api/admin/cpu-types:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
