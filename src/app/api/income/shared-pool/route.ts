import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth/config";

/**
 * POST - Create income in Shared Pool mode
 * Just creates the income record - calculations happen at query time
 */
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
        const {
            id,
            householdMemberId,
            date,
            description,
            amount,
            currency,
            type,
            allocatedToMonth,
            transactionId,
        } = body;

        if (!householdMemberId || !date || !amount || !type) {
            return NextResponse.json(
                {
                    error: "Missing required fields: householdMemberId, date, amount, type",
                },
                { status: 400 },
            );
        }

        let income;
        const incomeDate = new Date(date);
        const incomeAmount = parseFloat(amount);

        if (id) {
            // Update existing income
            income = await prisma.income.update({
                where: { id },
                data: {
                    userId,
                    householdMemberId,
                    date: incomeDate,
                    allocatedToMonth: allocatedToMonth || null,
                    description: description || `${type} - ${date.slice(0, 7)}`,
                    amount: incomeAmount,
                    currency: currency || "EUR",
                    type,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                        },
                    },
                    householdMember: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
        } else {
            // Create new income
            income = await prisma.income.create({
                data: {
                    userId,
                    householdMemberId,
                    date: incomeDate,
                    allocatedToMonth: allocatedToMonth || null,
                    description: description || `${type} - ${date.slice(0, 7)}`,
                    amount: incomeAmount,
                    currency: currency || "EUR",
                    type,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                        },
                    },
                    householdMember: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
        }

        // Link transaction if transactionId is provided
        if (transactionId) {
            await prisma.transaction.updateMany({
                where: { transactionId },
                data: {
                    linkedToIncome: true,
                    incomeId: income.id,
                },
            });
        }

        return NextResponse.json({
            success: true,
            income,
            mode: "shared_pool",
        });
    } catch (error: unknown) {
        console.error("Error creating/updating shared pool income:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
