import { NextRequest, NextResponse } from "next/server";
import {
    getSharedPoolSummary,
    getCurrentMonth,
} from "@/lib/accounting/shared-pool";
import { auth } from "@/auth/config";

// GET - Fetch shared pool data for a specific month or current month
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const { searchParams } = new URL(request.url);
        const month = searchParams.get("month") || getCurrentMonth();

        const summary = await getSharedPoolSummary(month, userId);

        return NextResponse.json({
            success: true,
            month: summary.month,
            // Monthly metrics
            totalIncome: summary.totalIncome,
            totalPoolExpenses: summary.totalPoolExpenses,
            totalPersonalExpenses: summary.totalPersonalExpenses,
            poolBalance: summary.poolBalance,
            amountToPool: summary.amountToPool,
            amountToAllowances: summary.amountToAllowances,
            // Cumulative metrics
            cumulativePoolBalance: summary.cumulativePoolBalance,
            cumulativeTotalPoolSpent: summary.cumulativeTotalPoolSpent,
            cumulativeTotalAllowancesAllocated:
                summary.cumulativeTotalAllowancesAllocated,
            cumulativeTotalAllowancesSpent:
                summary.cumulativeTotalAllowancesSpent,
            // Per-member data
            memberAllowances: summary.memberAllowances,
            pendingReimbursements: summary.pendingReimbursements,
        });
    } catch (error: unknown) {
        console.error("Error fetching shared pool:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
