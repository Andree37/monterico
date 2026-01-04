import { NextRequest, NextResponse } from "next/server";
import { getSharedPoolSummary } from "@/lib/accounting/shared-pool";

// GET - Fetch shared pool data for a specific month or current month
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get("month") || undefined;

        const summary = await getSharedPoolSummary(month);

        return NextResponse.json({
            success: true,
            pool: summary.pool,
            allowances: summary.allowances,
            reimbursements: summary.reimbursements,
            totalReimbursementsOwed: summary.totalReimbursementsOwed,
        });
    } catch (error: unknown) {
        console.error("Error fetching shared pool:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
