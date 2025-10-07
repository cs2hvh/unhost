import { NextRequest } from "next/server";
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

export async function GET(_req: NextRequest) {
  const linodeToken = process.env.LINODE_API_TOKEN;

  if (!linodeToken) {
    return Response.json(
      { ok: false, error: "LINODE_API_TOKEN not configured" },
      { status: 500 }
    );
  }

  const result: any = {
    ok: false,
    auth: { authenticated: false },
    regions: null as null | unknown,
  };

  try {
    const client = new LinodeAPIClient({
      api_token: linodeToken,
      region: "us-east",
    });

    // Test authentication by fetching regions
    const regions = await client.getRegions();

    result.auth = { authenticated: true };
    result.regions = regions;
    result.ok = true;

    return Response.json(result);
  } catch (e: any) {
    result.auth = {
      authenticated: false,
      error: e?.message,
      errorDetails: serializeError(e),
    };

    return Response.json(
      { ...result, error: e?.message || "Authentication to Linode failed" },
      { status: 401 }
    );
  }
}
