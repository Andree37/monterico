import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth/config";

// GET - Fetch reimbursements for a specific month or user
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const authenticatedUserId = session.user.id;
        const { searchParams } = new URL(request.url);
        const monthParam = searchParams.get("month");
        const householdMemberId = searchParams.get("householdMemberId");
        const settled = searchParams.get("settled");

        const where: {
            month?: string;
            userId?: string;
            householdMemberId?: string;
            settled?: boolean;
        } = {
            userId: authenticatedUserId,
        };

        if (monthParam && monthParam !== "all") {
            where.month = monthParam;
        }

        if (householdMemberId) {
            where.householdMemberId = householdMemberId;
        }

        if (settled !== null && settled !== undefined) {
            where.settled = settled === "true";
        }

        const reimbursements = await prisma.reimbursement.findMany({
            where,
            include: {
                householdMember: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                expenses: {
                    include: {
                        category: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        const totalOwed = reimbursements
            .filter((r) => !r.settled)
            .reduce((sum, r) => sum + r.amount, 0);

        return NextResponse.json({
            success: true,
            reimbursements,
            totalOwed,
            count: reimbursements.length,
        });
    } catch (error: unknown) {
        console.error("Error fetching reimbursements:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST - Create a new reimbursement
export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const body = await request.json();
        const { householdMemberId, month, amount, description, expenseId } =
            body;

        if (!householdMemberId || !month || amount === undefined) {
            return NextResponse.json(
                { error: "householdMemberId, month, and amount are required" },
                { status: 400 },
            );
        }

        const reimbursement = await prisma.reimbursement.create({
            data: {
                userId,
                householdMemberId,
                month,
                amount,
                description: description || "Reimbursement",
                settled: false,
            },
            include: {
                householdMember: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // If expenseId is provided, link the expense to this reimbursement
        if (expenseId) {
            await prisma.expense.update({
                where: { id: expenseId },
                data: {
                    reimbursementId: reimbursement.id,
                    needsReimbursement: true,
                },
            });
        }

        return NextResponse.json({
            success: true,
            reimbursement,
        });
    } catch (error: unknown) {
        console.error("Error creating reimbursement:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PUT - Mark reimbursement as settled
export async function PUT(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const body = await request.json();
        const { id, settled } = body;

        if (!id) {
            return NextResponse.json(
                { error: "Reimbursement id is required" },
                { status: 400 },
            );
        }

        const reimbursement = await prisma.reimbursement.update({
            where: { id },
            data: {
                settled: settled !== undefined ? settled : true,
                settledAt: settled !== false ? new Date() : null,
            },
            include: {
                householdMember: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                expenses: true,
            },
        });

        // Update linked expenses
        if (reimbursement.expenses.length > 0) {
            await Promise.all(
                reimbursement.expenses.map((expense) =>
                    prisma.expense.update({
                        where: { id: expense.id },
                        data: {
                            needsReimbursement: !settled,
                        },
                    }),
                ),
            );
        }

        return NextResponse.json({
            success: true,
            reimbursement,
        });
    } catch (error: unknown) {
        console.error("Error settling reimbursement:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE - Delete a reimbursement
export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Reimbursement id is required" },
                { status: 400 },
            );
        }

        // Get reimbursement with expenses before deleting
        const reimbursement = await prisma.reimbursement.findUnique({
            where: { id },
            include: { expenses: true },
        });

        if (!reimbursement) {
            return NextResponse.json(
                { error: "Reimbursement not found" },
                { status: 404 },
            );
        }

        // Unlink expenses first
        if (reimbursement.expenses.length > 0) {
            await Promise.all(
                reimbursement.expenses.map((expense) =>
                    prisma.expense.update({
                        where: { id: expense.id },
                        data: {
                            reimbursementId: null,
                            needsReimbursement: false,
                        },
                    }),
                ),
            );
        }

        // Delete reimbursement
        await prisma.reimbursement.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "Reimbursement deleted",
        });
    } catch (error: unknown) {
        console.error("Error deleting reimbursement:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
