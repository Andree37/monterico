import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
    getMonthFromDate,
    deductFromSharedPool,
    deductFromPersonalAllowance,
    createReimbursementForExpense,
} from "@/lib/accounting/shared-pool";

/**
 * POST - Create expense in Shared Pool mode
 * This handles expense creation with pool deductions and reimbursements
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            date,
            description,
            categoryId,
            amount,
            currency,
            paidById,
            type,
            paidFromPool,
            transactionId,
        } = body;

        if (!date || !description || !categoryId || !amount || !paidById) {
            return NextResponse.json(
                {
                    error: "Missing required fields: date, description, categoryId, amount, paidById",
                },
                { status: 400 },
            );
        }

        const expenseDate = new Date(date);
        const month = getMonthFromDate(expenseDate);

        const expense = await prisma.expense.create({
            data: {
                date: expenseDate,
                description,
                categoryId,
                amount: parseFloat(amount),
                currency: currency || "EUR",
                paidById,
                type: type || "shared",
                paid: false,
                paidFromPool: paidFromPool || false,
                needsReimbursement: false,
            },
        });

        let warning: string | undefined;

        if (type === "personal") {
            const result = await deductFromPersonalAllowance(
                paidById,
                parseFloat(amount),
                month,
            );

            if (!result.success) {
                await prisma.expense.delete({ where: { id: expense.id } });
                return NextResponse.json(
                    {
                        error:
                            result.error ||
                            "Failed to deduct from personal allowance",
                    },
                    { status: 400 },
                );
            }

            if (result.warning) {
                warning = result.warning;
            }
        } else {
            if (paidFromPool) {
                const result = await deductFromSharedPool(
                    expense.id,
                    parseFloat(amount),
                    month,
                );

                if (!result.success) {
                    await prisma.expense.delete({ where: { id: expense.id } });
                    return NextResponse.json(
                        {
                            error:
                                result.error ||
                                "Failed to deduct from shared pool",
                        },
                        { status: 400 },
                    );
                }
            } else {
                const result = await createReimbursementForExpense(
                    expense.id,
                    paidById,
                    parseFloat(amount),
                    description,
                    month,
                );

                if (!result.success) {
                    await prisma.expense.delete({ where: { id: expense.id } });
                    return NextResponse.json(
                        {
                            error:
                                result.error ||
                                "Failed to create reimbursement",
                        },
                        { status: 400 },
                    );
                }
            }
        }

        if (transactionId) {
            await prisma.transaction.updateMany({
                where: { transactionId },
                data: {
                    linkedToExpense: true,
                    expenseId: expense.id,
                },
            });
        }

        const completeExpense = await prisma.expense.findUnique({
            where: { id: expense.id },
            include: {
                category: true,
                paidBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                reimbursement: {
                    select: {
                        id: true,
                        amount: true,
                        settled: true,
                        settledAt: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            expense: completeExpense,
            mode: "shared_pool",
            warning,
        });
    } catch (error: unknown) {
        console.error("Error creating shared pool expense:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
