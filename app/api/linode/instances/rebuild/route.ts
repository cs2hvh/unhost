import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LinodeAPIClient } from "@/lib/linode";

export const dynamic = "force-dynamic";

function getBearer(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7) : undefined;
}

export async function POST(req: NextRequest) {
  const bearer = getBearer(req);
  if (!bearer) return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { serverId, image, sshKeyIds } = body;

  if (!serverId) {
    return Response.json({ ok: false, error: "serverId required" }, { status: 400 });
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const authClient = createClient(sbUrl, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } as any }
  } as any);

  const { data: userData } = await authClient.auth.getUser();
  const userId = userData?.user?.id as string | undefined;
  if (!userId) return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: server, error: serverErr } = await supabase
    .from("servers")
    .select("id, vmid, location, owner_id, os, details")
    .eq("id", serverId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (serverErr) return Response.json({ ok: false, error: serverErr.message }, { status: 500 });
  if (!server) return Response.json({ ok: false, error: "Server not found" }, { status: 404 });

  const instanceId = (server as any).vmid as number | undefined;
  const region = (server as any).location as string | undefined;
  const currentOS = (server as any).os as string | undefined;
  const serverDetails = (server as any).details as any;

  if (!instanceId || !region) {
    return Response.json({ ok: false, error: "Missing instance ID or region" }, { status: 400 });
  }

  const linodeToken = process.env.LINODE_API_TOKEN;
  if (!linodeToken) {
    return Response.json({ ok: false, error: "Linode API token not configured" }, { status: 500 });
  }

  try {
    const client = new LinodeAPIClient({
      api_token: linodeToken,
      region,
    });

    // Get Linode API to fetch the instance's current configuration
    const instance = await client.getInstance(instanceId);

    // Try multiple sources for SSH keys
    let authorizedKeys: string[] = [];

    // 1. Check Linode instance specs (if they return authorized_keys)
    if (instance.specs?.authorized_keys && Array.isArray(instance.specs.authorized_keys)) {
      authorizedKeys = instance.specs.authorized_keys;
    }

    // 2. Check server details stored in database
    if (authorizedKeys.length === 0 && serverDetails?.authorized_keys && Array.isArray(serverDetails.authorized_keys)) {
      authorizedKeys = serverDetails.authorized_keys;
    }

    // 3. Fetch SSH keys directly from Linode account
    if (authorizedKeys.length === 0) {
      try {
        const sshKeysResponse = await client.client.get('/profile/sshkeys');
        const linodeSSHKeys = sshKeysResponse.data.data || [];
        // Use all SSH keys from the account
        authorizedKeys = linodeSSHKeys.map((key: any) => key.ssh_key).filter(Boolean);
        console.log(`Found ${authorizedKeys.length} SSH keys from Linode account`);
      } catch (err) {
        console.error('Failed to fetch SSH keys from Linode:', err);
      }
    }

    // If still no keys, require user to provide them
    if (authorizedKeys.length === 0) {
      return Response.json({
        ok: false,
        error: "No SSH keys found. Please add SSH keys to your Linode account at https://cloud.linode.com/profile/keys before rebuilding."
      }, { status: 400 });
    }

    console.log(`Using ${authorizedKeys.length} SSH key(s) for rebuild`);

    // Use provided image or fall back to current OS
    const imageToUse = image || currentOS || instance.image || 'linode/ubuntu22.04';

    console.log(`Rebuilding server ${serverId} (instance ${instanceId}) with image: ${imageToUse}`);

    // Generate a secure random root password (required by Linode even with SSH keys)
    const generatePassword = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let password = '';
      for (let i = 0; i < 32; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    // Rebuild using Linode's rebuild API directly (with root_pass requirement)
    const rebuildPayload: any = {
      image: imageToUse,
      root_pass: generatePassword(),
      authorized_keys: authorizedKeys,
    };

    const response = await client.client.post(`/linode/instances/${instanceId}/rebuild`, rebuildPayload);
    const rebuiltInstance = response.data;

    // Update database status
    const { error: updateErr } = await supabase
      .from("servers")
      .update({
        status: 'rebuilding',
        os: imageToUse,
      })
      .eq("id", serverId);

    if (updateErr) {
      console.error('Failed to update server status:', updateErr);
    }

    console.log(`Server ${serverId} rebuild initiated successfully`);

    return Response.json({
      ok: true,
      message: "Instance rebuild initiated. All data will be wiped and OS will be reinstalled.",
      server: {
        id: serverId,
        status: 'rebuilding',
        image: imageToUse,
      }
    });
  } catch (e: any) {
    console.error('Linode rebuild error:', e);
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
