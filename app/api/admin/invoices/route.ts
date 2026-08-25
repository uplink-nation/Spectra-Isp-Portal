import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin-auth";
import {
  getDbInvoices,
  createDbInvoice,
  batchCreateDbInvoices,
  markDbInvoicePaid,
  getAllDbCustomers,
} from "@/lib/supabase/admin";

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

    const invoices = await getDbInvoices();
    return NextResponse.json({ ok: true, invoices });
  } catch (error: unknown) {
    console.error("Admin invoices fetch error:", error);
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
    const { action } = body as {
      action: "batch_generate" | "create_single" | "mark_paid";
    };

    // 1. ACTION: BATCH GENERATE MONTHLY INVOICES FOR ALL CUSTOMERS IN DB
    if (action === "batch_generate") {
      const {
        period_start,
        period_end,
        issue_date,
        due_date,
        plan_name = "Spectra GigaFiber 300 Mbps Unlimited",
        base_amount = 999.0,
      } = body as {
        period_start: string;
        period_end: string;
        issue_date: string;
        due_date: string;
        plan_name?: string;
        base_amount?: number;
      };

      if (!period_start || !period_end || !due_date) {
        return NextResponse.json(
          { error: "Missing required billing period dates" },
          { status: 400 }
        );
      }

      const result = await batchCreateDbInvoices({
        period_start,
        period_end,
        issue_date: issue_date || period_start,
        due_date,
        plan_name,
        base_amount: Number(base_amount),
      });

      return NextResponse.json({
        ok: true,
        count: result.count,
        invoices: result.invoices,
      });
    }

    // 2. ACTION: CREATE SINGLE CUSTOM INVOICE FOR A SUBSCRIBER
    if (action === "create_single") {
      const {
        customer_id,
        plan_name = "Spectra GigaFiber 300 Mbps Unlimited",
        period_start,
        period_end,
        issue_date,
        due_date,
        base_amount,
        status = "pending",
        payment_method,
        transaction_ref,
      } = body as {
        customer_id: string;
        plan_name: string;
        period_start: string;
        period_end: string;
        issue_date: string;
        due_date: string;
        base_amount: number;
        status?: "paid" | "pending" | "overdue";
        payment_method?: string;
        transaction_ref?: string;
      };

      if (!customer_id || !period_start || !period_end || !base_amount) {
        return NextResponse.json(
          { error: "Customer, billing period, and base amount are required." },
          { status: 400 }
        );
      }

      // Find customer info to enrich
      const customers = await getAllDbCustomers();
      const matchedCust = customers.find((c) => c.id === customer_id);

      const createdInvoice = await createDbInvoice({
        customer_id,
        plan_name,
        period_start,
        period_end,
        issue_date: issue_date || period_start,
        due_date: due_date || period_end,
        base_amount: Number(base_amount),
        status,
        payment_method,
        transaction_ref,
        customer_name: matchedCust?.name || "Subscriber",
        pppoe_username: matchedCust?.pppoe_username || "N/A",
      });

      return NextResponse.json({ ok: true, invoice: createdInvoice });
    }

    // 3. ACTION: MARK AS PAID (OFFLINE SETTLEMENT / CASH / BANK TRANSFER)
    if (action === "mark_paid") {
      const {
        invoice_id,
        payment_method = "Cash / Bank Transfer",
        transaction_ref,
      } = body as {
        invoice_id: string;
        payment_method?: string;
        transaction_ref?: string;
      };

      if (!invoice_id) {
        return NextResponse.json({ error: "Missing invoice_id" }, { status: 400 });
      }

      const updatedInvoice = await markDbInvoicePaid({
        invoice_id,
        payment_method,
        transaction_ref,
      });

      return NextResponse.json({ ok: true, invoice: updatedInvoice });
    }

    return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
  } catch (error: unknown) {
    console.error("Admin invoices action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
