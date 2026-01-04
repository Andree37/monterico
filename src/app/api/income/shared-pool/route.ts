import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processIncomeForSharedPool } from "@/lib/accounting/shared-pool";

/**
 * POST - Create income in Shared Pool mode
 * This adds income to the shared pool and allocates personal allowances
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            id,
            userId,
            date,
            description,
            amount,
            currency,
            type,
            allocatedToMonth,
        } = body;

        if (!userId || !date || !amount || !type) {
            return NextResponse.json(
                {
                    error: "Missing required fields: userId, date, amount, type",
                },
                { status: 400 },
            );
        }

        let income;
        const incomeDate = new Date(date);
        const incomeAmount = parseFloat(amount);

        if (id) {
            // Update existing income
            const existingIncome = await prisma.income.findUnique({
                where: { id },
            });

            if (!existingIncome) {
                return NextResponse.json(
                    { error: "Income not found" },
                    { status: 404 },
                );
            }

            // Calculate difference to adjust pool
            const difference = incomeAmount - existingIncome.amount;

            income = await prisma.income.update({
                where: { id },
                data: {
                    userId,
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
                            name: true,
                        },
                    },
                },
            });

            // Update shared pool with the difference
            if (difference !== 0) {
                const result = await processIncomeForSharedPool(
                    userId,
                    difference,
                    incomeDate,
                    allocatedToMonth,
                );

                if (!result.success) {
                    return NextResponse.json({
                        success: true,
                        income,
                        warning: `Income updated but pool not adjusted: ${result.error}`,
                    });
                }
            }
        } else {
            // Create new income
            income = await prisma.income.create({
                data: {
                    userId,
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
                            name: true,
                        },
                    },
                },
            });

            // Process income for shared pool
            const result = await processIncomeForSharedPool(
                userId,
                incomeAmount,
                incomeDate,
                allocatedToMonth,
            );

            if (!result.success) {
                return NextResponse.json(
                    {
                        error: `Income created but pool not updated: ${result.error}`,
                    },
                    { status: 500 },
                );
            }
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
