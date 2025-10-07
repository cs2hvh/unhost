import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LinodeAPIClient } from "@/lib/linode";

export const dynamic = "force-dynamic";

function getBearer(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7) : undefined;
}

export async function GET(req: NextRequest) {
  const bearer = getBearer(req);
  if (!bearer) return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const serverId = url.searchParams.get("serverId");

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

  // Use service role key for database operations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: server, error: serverErr } = await supabase
    .from("servers")
    .select("id, vmid, node, location")
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

    const stats = await client.getInstanceStats(instanceId);

    // Linode stats format: { cpu: [[timestamp, value], ...], io: {io: [[ts, val], ...]}, netv4: {in: [[ts, val], ...]} }
    const series = [];

    // Get data arrays (Linode returns tuples: [timestamp_ms, value])
    const cpuData = stats.cpu || [];
    const netInData = stats.netv4?.in || [];
    const netOutData = stats.netv4?.out || [];

    // Use CPU data length as baseline (usually all arrays have same length)
    const dataLength = cpuData.length;

    for (let i = 0; i < dataLength; i++) {
      const cpuPoint = cpuData[i] || [0, null];
      const netInPoint = netInData[i] || [cpuPoint[0], null];
      const netOutPoint = netOutData[i] || [cpuPoint[0], null];

      // Linode timestamps are in milliseconds, convert to seconds
      const timestamp = Math.floor(cpuPoint[0] / 1000);

      series.push({
        t: timestamp,
        cpu: cpuPoint[1] !== null && cpuPoint[1] !== undefined ? cpuPoint[1] : null,
        memUsed: null, // Linode doesn't provide memory percentage in stats API
        netIn: netInPoint[1] !== null && netInPoint[1] !== undefined ? netInPoint[1] : null,
        netOut: netOutPoint[1] !== null && netOutPoint[1] !== undefined ? netOutPoint[1] : null,
      });
    }

    return Response.json({
      ok: true,
      series,
      dataPoints: dataLength,
      note: "Linode statistics"
    });
  } catch (e: any) {
    console.error('Linode metrics error:', e);
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
