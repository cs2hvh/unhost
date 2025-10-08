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
  const limit = Number(url.searchParams.get('limit') || '200');
  const ownerId = url.searchParams.get('ownerId');
  const status = url.searchParams.get('status');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ ok: false, error: 'Missing Supabase configuration' }, { status: 500 });
  }

  const service = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let query = service
      .from('servers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 500));

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: servers, error } = await query;

    if (error) {
      console.error('Error fetching servers:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Fetch owner emails for each server
    const ownerIds = [...new Set(servers?.map(s => s.owner_id).filter(Boolean) || [])];
    const owners = new Map<string, string>();

    if (ownerIds.length > 0) {
      const { data: users } = await service.auth.admin.listUsers();
      users?.users?.forEach(user => {
        if (ownerIds.includes(user.id)) {
          owners.set(user.id, user.email || 'Unknown');
        }
      });
    }

    const serversWithOwner = servers?.map(server => ({
      ...server,
      owner_email: owners.get(server.owner_id) || 'Unknown'
    })) || [];

    return NextResponse.json({
      ok: true,
      servers: serversWithOwner,
      count: serversWithOwner.length
    });
  } catch (error: any) {
    console.error('Admin servers GET error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    console.error('Admin delete - not authorized:', gate);
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { serverId } = body;

    console.log('Admin delete server request:', { serverId, adminEmail: gate.email });

    if (!serverId) {
      return NextResponse.json({ ok: false, error: 'serverId required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
    }

    const service = createClient(supabaseUrl, supabaseServiceKey);

    // Get server details first
    const { data: server, error: fetchError } = await service
      .from('servers')
      .select('*')
      .eq('id', serverId)
      .single();

    if (fetchError) {
      console.error('Error fetching server:', fetchError);
      return NextResponse.json({ ok: false, error: `Server fetch error: ${fetchError.message}` }, { status: 500 });
    }

    if (!server) {
      console.error('Server not found:', serverId);
      return NextResponse.json({ ok: false, error: 'Server not found' }, { status: 404 });
    }

    console.log('Found server to delete:', { id: server.id, name: server.name, linode_id: server.linode_id });

    // Delete from Linode if linode_id exists
    let linodeDeleted = false;
    let linodeError: string | null = null;

    if (server.linode_id) {
      const linodeToken = process.env.LINODE_API_TOKEN;
      if (linodeToken) {
        try {
          console.log(`Attempting to delete Linode instance ${server.linode_id}`);
          const deleteResponse = await fetch(
            `https://api.linode.com/v4/linode/instances/${server.linode_id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${linodeToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text();
            linodeError = `Linode API error (${deleteResponse.status}): ${errorText}`;
            console.error(`Failed to delete Linode instance ${server.linode_id}:`, linodeError);

            // If it's a 404, the instance doesn't exist anymore - that's OK
            if (deleteResponse.status === 404) {
              console.log('Linode instance already deleted or not found');
              linodeDeleted = true;
              linodeError = null;
            }
          } else {
            console.log(`Successfully deleted Linode instance ${server.linode_id}`);
            linodeDeleted = true;
          }
        } catch (err: any) {
          console.error('Error deleting from Linode:', err);
          linodeError = `Network error: ${err.message}`;
          // Continue with database deletion even if Linode deletion fails
        }
      } else {
        console.log('No Linode API token configured, skipping Linode deletion');
        linodeError = 'No Linode API token configured';
      }
    } else {
      console.log('No linode_id found, skipping Linode deletion');
      linodeDeleted = true; // No Linode to delete
    }

    // Delete from database
    console.log('Deleting server from database:', serverId);
    const { error: deleteError } = await service
      .from('servers')
      .delete()
      .eq('id', serverId);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
    }

    console.log('Server deleted successfully:', serverId);

    // Return detailed result
    const result: any = {
      ok: true,
      message: 'Server deleted from database',
      linodeDeleted,
    };

    if (linodeError) {
      result.linodeError = linodeError;
      result.message = 'Server deleted from database, but Linode deletion failed';
    } else if (linodeDeleted && server.linode_id) {
      result.message = 'Server deleted from both database and Linode';
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Admin server DELETE error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
