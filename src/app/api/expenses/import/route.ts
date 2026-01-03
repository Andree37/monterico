import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateExpenseSplits } from "@/lib/users";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { transactionIds, userId, splitType } = body;

        if (!transactionIds || !Array.isArray(transactionIds)) {
            return NextResponse.json(
                { error: "Missing transaction IDs" },
                { status: 400 },
            );
        }

        const transactions = await prisma.transaction.findMany({
            where: {
                transactionId: { in: transactionIds },
                linkedToExpense: false,
            },
        });

        // Get active users for splitting
        const activeUsers = await prisma.user.findMany({
            include: {
                _count: true,
            },
        });

        const userRatios = await prisma.userSplitRatio.findMany({
            where: {
                userId: { in: activeUsers.map((u) => u.id) },
                isActive: true,
            },
        });

        if (userRatios.length === 0) {
            return NextResponse.json(
                { error: "No active users found for splitting expenses" },
                { status: 400 },
            );
        }

        // Determine default paidBy user
        let defaultPaidBy = userId;
        if (!defaultPaidBy) {
            const settings = await prisma.settings.findFirst();
            defaultPaidBy = settings?.defaultPaidBy || userRatios[0]?.userId;
        }

        // Determine split type
        const effectiveSplitType = splitType || "equal";

        const createdExpenses = [];

        for (const transaction of transactions) {
            const categoryName =
                transaction.category?.split(",")[0] || "Outros";

            let category = await prisma.category.findFirst({
                where: {
                    name: {
                        contains: categoryName,
                    },
                },
            });

            if (!category) {
                category = await prisma.category.findFirst({
                    where: { name: "Restaurantes" },
                });
            }

            if (!category) continue;

            const amount = Math.abs(transaction.amount);

            // Calculate splits based on the split type
            const splits = await calculateExpenseSplits(
                amount,
                effectiveSplitType as "equal" | "ratio" | "custom",
            );

            const expense = await prisma.expense.create({
                data: {
                    date: new Date(transaction.date),
                    description: transaction.name,
                    categoryId: category.id,
                    amount: amount,
                    currency: transaction.currency || "EUR",
                    paidById: defaultPaidBy,
                    type: "shared",
                    paid: !transaction.pending,
                    splits: {
                        create: splits.map((split) => ({
                            userId: split.userId,
                            amount: split.amount,
                            paid: split.userId === defaultPaidBy,
                        })),
                    },
                },
                include: {
                    category: true,
                    paidBy: true,
                    splits: {
                        include: {
                            user: true,
                        },
                    },
                },
            });

            await prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                    linkedToExpense: true,
                    expenseId: expense.id,
                },
            });

            createdExpenses.push(expense);
        }

        return NextResponse.json({
            success: true,
            imported: createdExpenses.length,
            expenses: createdExpenses,
        });
    } catch (error: unknown) {
        console.error("Error importing transactions:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
