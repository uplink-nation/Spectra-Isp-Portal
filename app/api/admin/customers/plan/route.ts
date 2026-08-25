import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin-auth";
import { setCustomerPlan, getCustomerPlan, getAllIspPlans } from "@/lib/plan-store";
import type { CustomerPlan } from "@/types/portal";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Administrator privileges required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId") || undefined;
    const pppoeUsername = searchParams.get("pppoeUsername") || undefined;

    if (customerId || pppoeUsername) {
      const plan = getCustomerPlan(customerId, pppoeUsername);
      return NextResponse.json({ ok: true, plan });
    }

    const plans = getAllIspPlans();
    return NextResponse.json({ ok: true, plans });
  } catch (error: unknown) {
    console.error("Admin plans GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Administrator privileges required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { customerId, pppoeUsername, plan } = body;

    if (!customerId || !plan) {
      return NextResponse.json(
        { error: "Missing customerId or plan object in payload." },
        { status: 400 }
      );
    }

    const speed = Number(plan.speed_mbps) || 300;
    const uploadSpeed = Number(plan.upload_speed_mbps) || speed;
    const price = Number(plan.price_inr) || 999;
    const planName = String(plan.plan_name || `${speed} Mbps Symmetric Fiber`).trim();

    const planPayload: CustomerPlan = {
      plan_id: plan.plan_id || `custom-${speed}mbps`,
      plan_name: planName,
      speed_mbps: speed,
      upload_speed_mbps: uploadSpeed,
      price_inr: price,
      data_limit_gb: plan.data_limit_gb ? Number(plan.data_limit_gb) : null,
      billing_cycle: plan.billing_cycle || "monthly",
      renewal_date: plan.renewal_date || undefined,
      description: plan.description || `${speed} Mbps Symmetric Fiber with 24x7 SLA guarantee`,
    };

    const result = await setCustomerPlan(customerId, pppoeUsername, planPayload);

    console.log(`[Admin Plan API] Updated plan for customer ${customerId} (${pppoeUsername || ""}) -> ${planName} (${speed} Mbps)`);

    return NextResponse.json({
      ok: true,
      message: `Plan updated successfully for ${pppoeUsername || customerId}`,
      plan: result.plan,
    });
  } catch (error: unknown) {
    console.error("Admin plans POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
