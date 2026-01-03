import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { transactionIds, userId } = body;

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

        const createdExpenses = [];

        for (const transaction of transactions) {
            const categoryName = transaction.category?.split(",")[0] || "Outros";

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
            const splitAmount = amount / 2;

            const expense = await prisma.expense.create({
                data: {
                    date: new Date(transaction.date),
                    description: transaction.name,
                    categoryId: category.id,
                    amount: amount,
                    currency: transaction.currency || "EUR",
                    paidById: userId || "andre",
                    type: "shared",
                    paid: !transaction.pending,
                    splits: {
                        create: [
                            {
                                userId: "andre",
                                amount: splitAmount,
                                paid: false,
                            },
                            {
                                userId: "rita",
                                amount: splitAmount,
                                paid: false,
                            },
                        ],
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
    } catch (error: any) {
        console.error("Error importing transactions:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
