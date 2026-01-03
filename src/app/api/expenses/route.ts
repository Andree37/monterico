import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        const where: any = {};

        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }

        const expenses = await prisma.expense.findMany({
            where,
            include: {
                category: true,
                paidBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                splits: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: { date: "desc" },
        });

        return NextResponse.json({
            success: true,
            expenses,
            count: expenses.length,
        });
    } catch (error: any) {
        console.error("Error fetching expenses:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

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
            splits,
            transactionId,
        } = body;

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
                splits: {
                    create: splits.map((split: any) => ({
                        userId: split.userId,
                        amount: parseFloat(split.amount),
                        paid: split.paid || false,
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

        // If a transactionId was provided, link it to the expense
        if (transactionId) {
            await prisma.transaction.updateMany({
                where: { transactionId: transactionId },
                data: {
                    linkedToExpense: true,
                    expenseId: expense.id,
                },
            });
        }

        return NextResponse.json({
            success: true,
            expense,
        });
    } catch (error: any) {
        console.error("Error creating expense:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, paid } = body;

        // Update expense and all its splits to the same paid status
        const expense = await prisma.expense.update({
            where: { id },
            data: { paid },
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

        // Update all splits to match the expense paid status
        await prisma.expenseSplit.updateMany({
            where: { expenseId: id },
            data: { paid },
        });

        // Fetch updated expense with updated splits
        const updatedExpense = await prisma.expense.findUnique({
            where: { id },
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

        return NextResponse.json({
            success: true,
            expense: updatedExpense,
        });
    } catch (error: any) {
        console.error("Error updating expense:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Missing expense ID" },
                { status: 400 },
            );
        }

        await prisma.expense.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "Expense deleted",
        });
    } catch (error: any) {
        console.error("Error deleting expense:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
