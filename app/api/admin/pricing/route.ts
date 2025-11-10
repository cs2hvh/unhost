import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../_utils';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// GET - List all pricing
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ ok: false, error: 'Missing Supabase configuration' }, { status: 500 });
  }

  const service = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: pricing, error } = await service
      .from('server_pricing')
      .select('*')
      .order('plan_category', { ascending: true })
      .order('hourly_price', { ascending: true });

    if (error) {
      console.error('Error fetching pricing:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      pricing: pricing || []
    });
  } catch (error: any) {
    console.error('Admin pricing GET error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update pricing
export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, hourly_price, monthly_price, is_active } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
    }

    const service = createClient(supabaseUrl, supabaseServiceKey);

    const updates: any = {};
    if (hourly_price !== undefined) updates.hourly_price = parseFloat(hourly_price);
    if (monthly_price !== undefined) updates.monthly_price = parseFloat(monthly_price);
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 });
    }

    const { data, error } = await service
      .from('server_pricing')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating pricing:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      pricing: data
    });
  } catch (error: any) {
    console.error('Admin pricing PUT error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// POST - Create new pricing entry
export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { plan_id, plan_category, plan_name, hourly_price, monthly_price, is_active } = body;

    if (!plan_id || !plan_category || !plan_name) {
      return NextResponse.json({ ok: false, error: 'plan_id, plan_category, and plan_name required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
    }

    const service = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await service
      .from('server_pricing')
      .insert({
        plan_id,
        plan_category,
        plan_name,
        hourly_price: parseFloat(hourly_price || '0'),
        monthly_price: parseFloat(monthly_price || '0'),
        is_active: is_active !== undefined ? is_active : true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating pricing:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      pricing: data
    });
  } catch (error: any) {
    console.error('Admin pricing POST error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
