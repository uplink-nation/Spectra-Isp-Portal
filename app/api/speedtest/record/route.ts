import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbSpeedTest, getDbSpeedTests } from "@/lib/supabase/admin";
import type { Customer, SpeedTestRecord } from "@/types/portal";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, pppoe_username")
      .eq("auth_user_id", user.id)
      .maybeSingle<Customer>();

    if (!customer) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    const records = await getDbSpeedTests(customer.id);

    return NextResponse.json({
      ok: true,
      records,
    });
  } catch (error: unknown) {
    console.error("Speed test history query error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, pppoe_username")
      .eq("auth_user_id", user.id)
      .maybeSingle<Customer>();

    if (!customer) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      download_mbps,
      upload_mbps,
      ping_ms,
      jitter_ms,
      server_name,
      server_location,
      client_ip,
      isp_name,
      grade,
      engine,
    } = body as {
      download_mbps: number;
      upload_mbps: number;
      ping_ms: number;
      jitter_ms: number;
      server_name?: string;
      server_location?: string;
      client_ip?: string;
      isp_name?: string;
      grade?: SpeedTestRecord["grade"];
      engine?: string;
    };

    if (download_mbps === undefined || upload_mbps === undefined || ping_ms === undefined) {
      return NextResponse.json({ error: "Missing required speed test metrics" }, { status: 400 });
    }

    const createdRecord = await createDbSpeedTest({
      customer_id: customer.id,
      pppoe_username: customer.pppoe_username,
      download_mbps: Number(download_mbps),
      upload_mbps: Number(upload_mbps),
      ping_ms: Number(ping_ms),
      jitter_ms: Number(jitter_ms || 0.5),
      server_name: server_name || "Cloudflare Edge",
      server_location: server_location || null,
      client_ip: client_ip || null,
      isp_name: isp_name || "Spectra Fiber",
      grade: grade || "A+",
      engine: engine || "cloudflare",
    });

    return NextResponse.json({
      ok: true,
      record: createdRecord,
    });
  } catch (error: unknown) {
    console.error("Speed test record creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
