import { NextRequest } from "next/server";
import { LinodeAPIClient, LINODE_PLAN_TYPES } from "@/lib/linode";
import { calculateHourlyCost, canAffordServer, type ServerSpecs } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { serverCreateSchema, validateSchema, isValidationError } from "@/lib/validations/schemas";
import { rateLimit } from "@/lib/rateLimit";
import { validateCSRFToken } from "@/lib/security/csrf";

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
  try {
    // Validate CSRF token
    if (!validateCSRFToken(req)) {
      return Response.json(
        { ok: false, error: "Invalid or missing CSRF token" },
        { status: 403 }
      );
    }

    const body = await req.json();
    
    // Apply rate limiting per user (3 server creations per hour)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('x-real-ip') || 
               'unknown';
    const rateLimitKey = body.ownerId ? `server-create:${body.ownerId}` : `server-create-ip:${ip}`;
    const rateLimitResult = rateLimit(rateLimitKey, 3, 60 * 60 * 1000); // 3 per hour
    
    if (!rateLimitResult.allowed) {
      return Response.json(
        { 
          ok: false, 
          error: 'Too many server creation requests. Please try again later.',
          retryAfter: (rateLimitResult as { allowed: false; retryAfter: number }).retryAfter
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String((rateLimitResult as { allowed: false; retryAfter: number }).retryAfter),
          }
        }
      );
    }
    
    // Validate input with Zod schema
    const validation = validateSchema(serverCreateSchema, {
      hostname: body.hostname,
      region: body.region || body.location,
      image: body.os || body.image || "linode/ubuntu24.04",
      planType: body.planType,
      sshKeys: body.sshKeys,
      ownerId: body.ownerId,
      ownerEmail: body.ownerEmail,
    });

    if (isValidationError(validation)) {
      return Response.json(
        { ok: false, error: validation.error },
        { status: 400 }
      );
    }

    const { hostname, region, image: os, planType, sshKeys, ownerId, ownerEmail } = validation.data;

    const supabase = await createClient();

    // Get API token from environment
    const linodeToken = process.env.LINODE_API_TOKEN;
    if (!linodeToken) {
      return Response.json({ ok: false, error: "VPS API token not configured" }, { status: 500 });
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

    const hourlyCost = await calculateHourlyCost(serverSpecs);
    const minimumHours = 1; // Require at least 1 hour of funding

    // Check user's wallet balance
    if (ownerId) {
      try {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', ownerId)
          .eq('currency', 'USD')
          .maybeSingle();

        const balance = wallet?.balance ? parseFloat(wallet.balance) : 0;

        const canAfford = await canAffordServer(balance, serverSpecs, minimumHours);
        if (!canAfford) {
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

    // Generate a secure random root password (API requires this even with SSH keys)
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
      root_pass: generatePassword(), // Required by API
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
        linode_id: instance.id, // Store Linode instance ID for deletion
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
      console.error('Instance created but DB save failed:', {
        instanceId: instance.id,
        error: insertErr.message
      });
      db.error = insertErr.message;
      // Don't delete the instance, just return error
      return Response.json({
        ok: false,
        error: "Server created successfully but failed to save to database. Instance ID: " + instance.id,
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
      error: e?.message || "Failed to create VPS instance",
      errorDetails: serializeError(e)
    }, { status: 500 });
  }
  } catch (err) {
    // Handle JSON parsing or validation errors
    console.error('Server creation error:', err);
    return Response.json({
      ok: false,
      error: err instanceof Error ? err.message : "Invalid request",
    }, { status: 400 });
  }
}
