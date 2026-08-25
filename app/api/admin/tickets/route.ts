import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin-auth";
import {
  getDbTickets,
  updateDbTicket,
  createDbTicket,
  getAllDbCustomers,
} from "@/lib/supabase/admin";
import type { SupportTicket } from "@/types/portal";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Administrator access required." },
        { status: 403 }
      );
    }

    const tickets = await getDbTickets();
    return NextResponse.json({ ok: true, tickets });
  } catch (error: unknown) {
    console.error("Admin tickets fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Administrator access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { ticket_id, status, priority, resolution_notes, assigned_to } = body as {
      ticket_id: string;
      status?: SupportTicket["status"];
      priority?: SupportTicket["priority"];
      resolution_notes?: string;
      assigned_to?: string;
    };

    if (!ticket_id) {
      return NextResponse.json({ error: "Missing ticket_id" }, { status: 400 });
    }

    const updated = await updateDbTicket({
      ticket_id,
      status,
      priority,
      resolution_notes,
      assigned_to,
    });

    return NextResponse.json({ ok: true, ticket: updated });
  } catch (error: unknown) {
    console.error("Admin ticket update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Administrator access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      customer_id,
      category = "general",
      subject,
      description,
      priority = "normal",
      contact_phone,
    } = body as {
      customer_id: string;
      category?: SupportTicket["category"];
      subject: string;
      description: string;
      priority?: SupportTicket["priority"];
      contact_phone?: string;
    };

    if (!customer_id || !subject?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: "Subscriber, subject, and description are required." },
        { status: 400 }
      );
    }

    const customers = await getAllDbCustomers();
    const matchedCust = customers.find((c) => c.id === customer_id);

    const newTicket = await createDbTicket({
      customer_id,
      category,
      subject: subject.trim(),
      description: description.trim(),
      priority,
      contact_phone: contact_phone || null,
      customer_name: matchedCust?.name || "Subscriber",
      pppoe_username: matchedCust?.pppoe_username || "N/A",
    });

    return NextResponse.json({ ok: true, ticket: newTicket });
  } catch (error: unknown) {
    console.error("Admin ticket create error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
