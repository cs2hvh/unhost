import { NextRequest } from "next/server";
import { LinodeAPIClient, LINODE_PLAN_TYPES } from "@/lib/linode";
import { calculateHourlyCost, canAffordServer, type ServerSpecs } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

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

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as any;

  const region = String(body.region || body.location || "");
  if (!region) return Response.json({ ok: false, error: "region required" }, { status: 400 });

  const supabase = await createClient();

  // Get Linode API token from environment
  const linodeToken = process.env.LINODE_API_TOKEN;
  if (!linodeToken) {
    return Response.json({ ok: false, error: "Linode API token not configured" }, { status: 500 });
  }

  const hostname = body.hostname || `linode-${Date.now()}`;
  const sshKeys = body.sshKeys as string[] | undefined; // Array of SSH public keys
  const planType = body.planType as string | undefined; // Linode plan ID (e.g., g6-standard-2)
  const os = body.os || body.image || "linode/ubuntu24.04";

  if (!sshKeys || sshKeys.length === 0) {
    return Response.json({ ok: false, error: "At least one SSH key is required" }, { status: 400 });
  }

  if (!planType) {
    return Response.json({ ok: false, error: "planType is required" }, { status: 400 });
  }

  // Get plan details
  const planDetails = LINODE_PLAN_TYPES[planType as keyof typeof LINODE_PLAN_TYPES];
  if (!planDetails) {
    return Response.json({ ok: false, error: "Invalid plan type" }, { status: 400 });
  }

  // Calculate server costs and check wallet balance
  const serverSpecs: ServerSpecs = {
    planType,
    location: region,
  };

  const hourlyCost = calculateHourlyCost(serverSpecs);
  const minimumHours = 1; // Require at least 1 hour of funding

  // Check user's wallet balance
  if (body.ownerId) {
    try {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', body.ownerId)
        .eq('currency', 'USD')
        .maybeSingle();

      const balance = wallet?.balance ? parseFloat(wallet.balance) : 0;

      if (!canAffordServer(balance, serverSpecs, minimumHours)) {
        return Response.json({
          ok: false,
          error: `Insufficient wallet balance. Required: $${(hourlyCost * minimumHours).toFixed(4)}, Available: $${balance.toFixed(2)}`,
          requiredBalance: hourlyCost * minimumHours,
          currentBalance: balance,
          hourlyCost
        }, { status: 402 }); // Payment Required
      }
    } catch (walletError) {
      console.warn('Wallet check failed:', walletError);
    }
  }

  let db = { saved: false as boolean, id: null as null | number, error: null as null | string };

  try {
    // Create Linode client
    const client = new LinodeAPIClient({
      api_token: linodeToken,
      region,
      default_image: os,
    });

    // Generate a secure random root password (Linode requires this even with SSH keys)
    const generatePassword = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let password = '';
      for (let i = 0; i < 32; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    // Create the instance FIRST
    const instance = await client.createInstance({
      label: hostname,
      region,
      type: planType,
      image: os,
      root_pass: generatePassword(), // Required by Linode API
      authorized_keys: sshKeys,
      private_ip: false,
      tags: body.ownerId ? [`user:${body.ownerId}`] : [],
    });

    const primaryIP = instance.ipv4?.[0] || "";

    // Now save to database AFTER successful creation
    const billingStart = new Date();
    const { data: inserted, error: insertErr } = await supabase
      .from("servers")
      .insert({
        vmid: instance.id,
        node: region,
        name: hostname,
        ip: primaryIP,
        os,
        location: region,
        cpu_cores: planDetails.vcpus,
        memory_mb: planDetails.memory,
        disk_gb: Math.round(planDetails.disk / 1024),
        status: instance.status,
        details: { planType, ...instance } as any,
        owner_id: body.ownerId || null,
        owner_email: body.ownerEmail || null,
        hourly_cost: hourlyCost,
        total_cost: 0,
        billing_start: billingStart.toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) {
      // Instance was created but DB save failed - log this
      console.error('Linode instance created but DB save failed:', {
        instanceId: instance.id,
        error: insertErr.message
      });
      db.error = insertErr.message;
      // Don't delete the instance, just return error
      return Response.json({
        ok: false,
        error: "Server created in Linode but failed to save to database. Instance ID: " + instance.id,
        instanceId: instance.id,
        db
      }, { status: 500 });
    }

    const reservationId = (inserted as any)?.id ?? null;
    db.saved = true;
    db.id = reservationId;

    // Update DB with instance details
    const responsePayload = {
      ok: true,
      node: region,
      vmid: instance.id,
      instanceId: instance.id,
      name: hostname,
      ip: primaryIP,
      os,
      location: region,
      planType,
      specs: {
        vcpus: planDetails.vcpus,
        memory: planDetails.memory,
        disk: planDetails.disk,
        transfer: planDetails.transfer
      },
      status: instance.status,
      details: instance,
      ssh: { username: "root", port: 22 },
    } as const;

    try {

      // Deduct initial payment from wallet (1 hour minimum charge)
      if (body.ownerId && hourlyCost > 0) {
        try {
          const initialCharge = hourlyCost * minimumHours;

          const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', body.ownerId)
            .eq('currency', 'USD')
            .maybeSingle();

          if (wallet) {
            const newBalance = parseFloat(wallet.balance) - initialCharge;

            await supabase
              .from('wallets')
              .update({ balance: newBalance })
              .eq('id', wallet.id);

            await supabase
              .from('wallet_transactions')
              .insert({
                wallet_id: wallet.id,
                user_id: body.ownerId,
                type: 'server_payment',
                amount: initialCharge,
                currency: 'USD',
                status: 'completed',
                description: `Initial charge for server ${hostname}`,
                reference_id: reservationId?.toString(),
                metadata: {
                  server_id: reservationId,
                  server_name: hostname,
                  specs: serverSpecs,
                  hourly_cost: hourlyCost,
                  plan_type: planType
                }
              });
          }
        } catch (walletErr) {
          console.warn('Wallet deduction failed:', walletErr);
        }
      }
    } catch (e: any) {
      db.error = e?.message || String(e);
    }

    return Response.json({
      ...responsePayload,
      db,
      pricing: {
        hourlyCost,
        initialCharge: hourlyCost * minimumHours,
        planType
      }
    });
  } catch (e: any) {
    // Instance creation failed - nothing to clean up in DB since we haven't saved yet
    return Response.json({
      ok: false,
      error: e?.message || "Failed to create Linode instance",
      errorDetails: serializeError(e)
    }, { status: 500 });
  }
}
