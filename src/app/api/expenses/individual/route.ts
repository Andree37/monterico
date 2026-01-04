import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createExpenseSplits } from "@/lib/accounting/individual-accounts";

/**
 * POST - Create expense in Individual Accounts mode
 * This handles expense creation with debt tracking between users
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
            splitType,
            customSplits,
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

        const expense = await prisma.expense.create({
            data: {
                date: new Date(date),
                description,
                categoryId,
                amount: parseFloat(amount),
                currency: currency || "EUR",
                paidById,
                type: type || "shared",
                paid: false,
                paidFromPool: false,
                needsReimbursement: false,
            },
        });

        if (type === "personal") {
            await prisma.expenseSplit.create({
                data: {
                    expenseId: expense.id,
                    userId: paidById,
                    amount: parseFloat(amount),
                    paid: true,
                },
            });
        } else if (type === "shared") {
            if (customSplits && customSplits.length > 0) {
                await Promise.all(
                    customSplits.map(
                        (split: { userId: string; amount: number }) =>
                            prisma.expenseSplit.create({
                                data: {
                                    expenseId: expense.id,
                                    userId: split.userId,
                                    amount: parseFloat(split.amount.toString()),
                                    paid: split.userId === paidById,
                                },
                            }),
                    ),
                );
            } else {
                const result = await createExpenseSplits(
                    expense.id,
                    parseFloat(amount),
                    splitType || "equal",
                );

                if (!result.success) {
                    await prisma.expense.delete({ where: { id: expense.id } });
                    return NextResponse.json(
                        {
                            error:
                                result.error ||
                                "Failed to create expense splits",
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
                splits: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            expense: completeExpense,
            mode: "individual",
        });
    } catch (error: unknown) {
        console.error("Error creating individual expense:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
