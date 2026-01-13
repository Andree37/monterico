import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createReimbursementForExpense } from "@/lib/accounting/shared-pool";
import { getAuthenticatedUser } from "@/lib/session";

/**
 * POST - Create expense in Shared Pool mode
 * Just creates the expense record - pool balance is calculated on-the-fly
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await getAuthenticatedUser();
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
        const expenseAmount = parseFloat(amount);

        // Determine if needs reimbursement (shared expense not paid from pool)
        const needsReimbursement = type === "shared" && paidFromPool === false;

        const expense = await prisma.expense.create({
            data: {
                userId,
                date: expenseDate,
                description,
                categoryId,
                amount: expenseAmount,
                currency: currency || "EUR",
                paidById,
                type: type || "shared",
                paid: type === "personal" ? true : paidFromPool === true,
                paidFromPool: paidFromPool || false,
                needsReimbursement,
            },
        });

        // If needs reimbursement, create the reimbursement record
        if (needsReimbursement) {
            const result = await createReimbursementForExpense(
                expense.id,
                paidById,
                expenseAmount,
            );

            if (!result.success) {
                await prisma.expense.delete({ where: { id: expense.id } });
                return NextResponse.json(
                    {
                        error: result.error || "Failed to create reimbursement",
                    },
                    { status: 400 },
                );
            }
        }

        // Link transaction if provided
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
        });
    } catch (error: unknown) {
        console.error("Error creating shared pool expense:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
