import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { serverId } = body;

    if (!serverId) {
      return NextResponse.json({ ok: false, error: 'serverId required' }, { status: 400 });
    }

    // Use service role client for database operations to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey);

    // Get server details and verify ownership
    const { data: server, error: fetchError } = await serviceClient
      .from('servers')
      .select('*')
      .eq('id', serverId)
      .single();

    if (fetchError) {
      console.error('Error fetching server:', fetchError);
      return NextResponse.json({ ok: false, error: `Server fetch error: ${fetchError.message}` }, { status: 500 });
    }

    if (!server) {
      return NextResponse.json({ ok: false, error: 'Server not found' }, { status: 404 });
    }

    // Verify user owns this server
    if (server.owner_id !== user.id) {
      return NextResponse.json({ ok: false, error: 'You can only delete your own servers' }, { status: 403 });
    }

    console.log('User deleting their server:', { userId: user.id, serverId, serverName: server.name, linodeId: server.linode_id });

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

    // Delete from database using service client
    console.log('Deleting server from database:', serverId);
    const { error: deleteError } = await serviceClient
      .from('servers')
      .delete()
      .eq('id', serverId)
      .eq('owner_id', user.id); // Double-check ownership

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
    }

    console.log('Server deleted successfully by user:', { userId: user.id, serverId });

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
    console.error('Server DELETE error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
