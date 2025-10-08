import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../_utils';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 });
  }

  const url = new URL(req.url);
  const perPage = Number(url.searchParams.get('perPage') || '100');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ ok: false, error: 'Missing Supabase configuration' }, { status: 500 });
  }

  const service = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get users from Supabase Auth
    const { data: authData, error: authError } = await service.auth.admin.listUsers({
      perPage: Math.min(perPage, 1000),
    });

    if (authError) {
      console.error('Error fetching users:', authError);
      return NextResponse.json({ ok: false, error: authError.message }, { status: 500 });
    }

    // Get user roles from user_roles table
    const userIds = authData.users.map(u => u.id);
    const { data: roles } = await service
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds);

    const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

    // Format users
    const users = authData.users.map(user => ({
      id: user.id,
      email: user.email || '',
      email_verified: user.email_confirmed_at ? true : false,
      created_at: user.created_at,
      last_sign_in: user.last_sign_in_at,
      role: rolesMap.get(user.id) || 'user',
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
    }));

    return NextResponse.json({
      ok: true,
      users,
      count: users.length,
    });
  } catch (error: any) {
    console.error('Admin users GET error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, role } = body;

    if (!id || !role) {
      return NextResponse.json({ ok: false, error: 'id and role required' }, { status: 400 });
    }

    if (role !== 'admin' && role !== 'user') {
      return NextResponse.json({ ok: false, error: 'role must be admin or user' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const service = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert role in user_roles table
    const { error: upsertError } = await service
      .from('user_roles')
      .upsert({
        user_id: id,
        role: role,
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('Error updating user role:', upsertError);
      return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'User role updated successfully' });
  } catch (error: any) {
    console.error('Admin user PATCH error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
