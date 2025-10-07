import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LinodeAPIClient } from "@/lib/linode";

export const dynamic = "force-dynamic";

function serializeError(err: unknown) {
  const e = err as any;
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    code: e?.code,
  };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : undefined;

  if (!bearer) {
    return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  // Verify user authentication
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const authClient = createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } as any },
  } as any);

  const { data: userData } = await authClient.auth.getUser();
  const userId = userData?.user?.id as string | undefined;

  if (!userId) {
    return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const linodeToken = process.env.LINODE_API_TOKEN;
  if (!linodeToken) {
    return Response.json({ ok: false, error: "Linode API token not configured" }, { status: 500 });
  }

  const result: any = {
    ok: false,
    auth: { authenticated: false },
    instances: [] as any[],
  };

  try {
    const client = new LinodeAPIClient({
      api_token: linodeToken,
      region: "us-east", // Default region
    });

    // Get all instances
    const instances = await client.listInstances();

    // Use service role key for database operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return Response.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's servers from DB to filter
    const { data: userServers } = await supabase
      .from('servers')
      .select('vmid, owner_id')
      .eq('owner_id', userId);

    const userInstanceIds = new Set((userServers || []).map((s: any) => Number(s.vmid)));

    // Filter instances to only show user's instances
    const filteredInstances = instances.filter(instance => userInstanceIds.has(instance.id));

    result.instances = filteredInstances;
    result.auth = { authenticated: true };
    result.ok = true;

    return Response.json(result);
  } catch (e: any) {
    result.auth = {
      authenticated: false,
      error: e?.message,
      errorDetails: serializeError(e),
    };

    return Response.json(
      { ...result, error: e?.message || "Failed to list instances" },
      { status: 500 }
    );
  }
}
