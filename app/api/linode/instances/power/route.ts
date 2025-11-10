import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LinodeAPIClient } from "@/lib/linode";
import { serverPowerActionSchema, validateSchema, isValidationError } from "@/lib/validations/schemas";

export const dynamic = "force-dynamic";

function getBearer(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7) : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const bearer = getBearer(req);
    if (!bearer) return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    // Verify user
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authClient = createClient(url, anon, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } as any },
    } as any);

    const { data: userData } = await authClient.auth.getUser();
    const userId = userData?.user?.id as string | undefined;
    if (!userId) return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    
    // Validate input
    const validation = validateSchema(serverPowerActionSchema, body);
    if (isValidationError(validation)) {
      return Response.json(
        { ok: false, error: validation.error },
        { status: 400 }
      );
    }

    const { serverId, action } = validation.data;

  // Use service role key for database operations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: server, error: serverErr } = await supabase
    .from('servers')
    .select('id, vmid, node, location')
    .eq('id', serverId)
    .eq('owner_id', userId)
    .maybeSingle();

  if (serverErr) return Response.json({ ok: false, error: serverErr.message }, { status: 500 });
  if (!server) return Response.json({ ok: false, error: "Server not found" }, { status: 404 });

  const instanceId = (server as any).vmid as number | undefined;
  const region = (server as any).location as string | undefined;

  if (!instanceId || !region) {
    return Response.json({ ok: false, error: "Missing instance ID or region" }, { status: 400 });
  }

  const linodeToken = process.env.LINODE_API_TOKEN;
  if (!linodeToken) {
    return Response.json({ ok: false, error: "VPS API token not configured" }, { status: 500 });
  }

  try {
    const client = new LinodeAPIClient({
      api_token: linodeToken,
      region,
    });

    // Perform power action
    if (action === 'start') {
      await client.bootInstance(instanceId);
    } else if (action === 'stop') {
      await client.shutdownInstance(instanceId);
    } else if (action === 'reboot') {
      await client.rebootInstance(instanceId);
    }

    // Get updated status
    let status = undefined as string | undefined;
    try {
      const instance = await client.getInstance(instanceId);
      status = instance.status;
    } catch {}

    // Update DB status
    try {
      if (status) {
        await supabase.from('servers').update({ status }).eq('id', serverId);
      }
    } catch {}

    return Response.json({ ok: true, action, instanceId, region, status: status || null });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
  } catch (err) {
    console.error('Power action error:', err);
    return Response.json({
      ok: false,
      error: err instanceof Error ? err.message : "Invalid request"
    }, { status: 400 });
  }
}
