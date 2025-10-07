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
  const { serverId } = body;

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
    .select("id, vmid, location, owner_id")
    .eq("id", serverId)
    .eq("owner_id", userId)
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
    return Response.json({ ok: false, error: "Linode API token not configured" }, { status: 500 });
  }

  try {
    const client = new LinodeAPIClient({
      api_token: linodeToken,
      region,
    });

    // Get current instance status from Linode
    const instance = await client.getInstance(instanceId);

    // Update database with current status and IP
    const { error: updateErr } = await supabase
      .from("servers")
      .update({
        status: instance.status,
        ip: instance.ipv4?.[0] || (server as any).ip,
      })
      .eq("id", serverId);

    if (updateErr) {
      return Response.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    console.log(`Synced server ${serverId}: status=${instance.status}, ip=${instance.ipv4?.[0]}`);

    return Response.json({
      ok: true,
      server: {
        id: serverId,
        status: instance.status,
        ip: instance.ipv4?.[0],
      },
      message: `Status synced: ${instance.status}`
    });
  } catch (e: any) {
    console.error('Linode sync error:', e);
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
