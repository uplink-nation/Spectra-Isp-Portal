import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin-auth";
import { getAllDbCustomers, getDbInvoices, getDbTickets } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Administrator privileges required." },
        { status: 403 }
      );
    }

    const [customers, invoices, tickets] = await Promise.all([
      getAllDbCustomers(),
      getDbInvoices(),
      getDbTickets(),
    ]);

    // Attach invoice & ticket counts to each customer
    const customersWithCounts = customers.map((c) => {
      const userInvoices = invoices.filter((i) => i.customer_id === c.id);
      const pendingInvoices = userInvoices.filter(
        (i) => i.status === "pending" || i.status === "overdue"
      );
      const userTickets = tickets.filter((t) => t.customer_id === c.id);
      const openTickets = userTickets.filter(
        (t) => t.status === "open" || t.status === "in_progress"
      );

      return {
        ...c,
        totalInvoicesCount: userInvoices.length,
        totalPendingInvoicesCount: pendingInvoices.length,
        totalTicketsCount: userTickets.length,
        totalOpenTicketsCount: openTickets.length,
      };
    });

    return NextResponse.json({
      ok: true,
      customers: customersWithCounts,
      totalCount: customersWithCounts.length,
    });
  } catch (error: unknown) {
    console.error("Admin API fetch users error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
