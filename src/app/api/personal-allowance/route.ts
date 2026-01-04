import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET - Fetch personal allowances for a specific month or current month
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get("month") || getCurrentMonth();
        const userId = searchParams.get("userId");

        if (userId) {
            // Get allowance for specific user
            const allowance = await prisma.personalAllowance.findUnique({
                where: {
                    userId_month: {
                        userId,
                        month,
                    },
                },
                include: {
                    user: true,
                },
            });

            if (!allowance) {
                return NextResponse.json({
                    success: true,
                    allowance: null,
                });
            }

            return NextResponse.json({
                success: true,
                allowance,
            });
        } else {
            // Get all allowances for the month
            const allowances = await prisma.personalAllowance.findMany({
                where: { month },
                include: {
                    user: true,
                },
                orderBy: {
                    createdAt: "asc",
                },
            });

            return NextResponse.json({
                success: true,
                allowances,
            });
        }
    } catch (error: unknown) {
        console.error("Error fetching personal allowances:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST - Create or update personal allowance for a user
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, month, allocated } = body;

        if (!userId || !month || allocated === undefined) {
            return NextResponse.json(
                { error: "userId, month, and allocated are required" },
                { status: 400 },
            );
        }

        const allowance = await prisma.personalAllowance.upsert({
            where: {
                userId_month: {
                    userId,
                    month,
                },
            },
            update: {
                allocated,
                remaining: allocated, // Reset remaining to allocated when updating
            },
            create: {
                userId,
                month,
                allocated,
                spent: 0,
                remaining: allocated,
            },
            include: {
                user: true,
            },
        });

        return NextResponse.json({
            success: true,
            allowance,
        });
    } catch (error: unknown) {
        console.error("Error creating/updating personal allowance:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PUT - Update spending on personal allowance
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, month, amount, operation } = body;

        if (!userId || !month || amount === undefined) {
            return NextResponse.json(
                { error: "userId, month, and amount are required" },
                { status: 400 },
            );
        }

        const allowance = await prisma.personalAllowance.findUnique({
            where: {
                userId_month: {
                    userId,
                    month,
                },
            },
        });

        if (!allowance) {
            return NextResponse.json(
                { error: "Personal allowance not found for this user/month" },
                { status: 404 },
            );
        }

        let newSpent = allowance.spent;
        let newRemaining = allowance.remaining;

        if (operation === "spend") {
            newSpent += amount;
            newRemaining -= amount;
        } else if (operation === "refund") {
            newSpent -= amount;
            newRemaining += amount;
        } else {
            return NextResponse.json(
                { error: "Invalid operation. Use 'spend' or 'refund'" },
                { status: 400 },
            );
        }

        const updatedAllowance = await prisma.personalAllowance.update({
            where: {
                userId_month: {
                    userId,
                    month,
                },
            },
            data: {
                spent: newSpent,
                remaining: newRemaining,
            },
            include: {
                user: true,
            },
        });

        return NextResponse.json({
            success: true,
            allowance: updatedAllowance,
        });
    } catch (error: unknown) {
        console.error("Error updating personal allowance:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PATCH - Rollover remaining allowance to savings for next month
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, month } = body;

        if (!userId || !month) {
            return NextResponse.json(
                { error: "userId and month are required" },
                { status: 400 },
            );
        }

        const allowance = await prisma.personalAllowance.findUnique({
            where: {
                userId_month: {
                    userId,
                    month,
                },
            },
        });

        if (!allowance) {
            return NextResponse.json(
                { error: "Personal allowance not found" },
                { status: 404 },
            );
        }

        const carriedTo = allowance.remaining > 0 ? allowance.remaining : 0;

        const updatedAllowance = await prisma.personalAllowance.update({
            where: {
                userId_month: {
                    userId,
                    month,
                },
            },
            data: {
                carriedTo,
            },
            include: {
                user: true,
            },
        });

        return NextResponse.json({
            success: true,
            allowance: updatedAllowance,
            carriedToNextMonth: carriedTo,
        });
    } catch (error: unknown) {
        console.error("Error rolling over allowance:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// Helper function to get current month in YYYY-MM format
function getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}
