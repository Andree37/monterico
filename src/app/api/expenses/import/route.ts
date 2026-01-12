import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth/config";

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
        const { transactionIds, householdMemberId, splitType } = body;

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

        // Get active household members for this user
        const activeMembers = await prisma.householdMember.findMany({
            where: {
                userId,
                isActive: true,
            },
        });

        const memberRatios = await prisma.householdMemberSplitRatio.findMany({
            where: {
                householdMemberId: { in: activeMembers.map((m) => m.id) },
                isActive: true,
            },
        });

        if (memberRatios.length === 0) {
            return NextResponse.json(
                {
                    error: "No active household members found for splitting expenses",
                },
                { status: 400 },
            );
        }

        // Determine default paidBy member
        let defaultPaidBy = householdMemberId;
        if (!defaultPaidBy) {
            // Use first active member as default
            defaultPaidBy = activeMembers[0]?.id;
        }

        // Determine split type
        const effectiveSplitType = splitType || "equal";

        const createdExpenses = [];

        for (const transaction of transactions) {
            const categoryName =
                transaction.category?.split(",")[0] || "Outros";

            let category = await prisma.category.findFirst({
                where: {
                    userId,
                    name: {
                        contains: categoryName,
                    },
                },
            });

            if (!category) {
                category = await prisma.category.findFirst({
                    where: {
                        userId,
                        name: "Restaurantes",
                    },
                });
            }

            // If still no category, create a default one
            if (!category) {
                category = await prisma.category.create({
                    data: {
                        userId,
                        name: "Outros",
                        icon: "📦",
                    },
                });
            }

            const amount = Math.abs(transaction.amount);

            // Calculate splits based on the split type
            let splits: Array<{
                householdMemberId: string;
                amount: number;
                paid: boolean;
            }> = [];

            if (effectiveSplitType === "equal") {
                const splitAmount = amount / activeMembers.length;
                splits = activeMembers.map((member) => ({
                    householdMemberId: member.id,
                    amount: splitAmount,
                    paid: member.id === defaultPaidBy,
                }));
            } else if (effectiveSplitType === "ratio") {
                const totalRatio = memberRatios.reduce(
                    (sum, mr) => sum + mr.ratio,
                    0,
                );

                if (totalRatio === 0) {
                    return NextResponse.json(
                        { error: "Total ratio is zero" },
                        { status: 400 },
                    );
                }

                splits = activeMembers.map((member) => {
                    const memberRatio = memberRatios.find(
                        (mr) => mr.householdMemberId === member.id,
                    );
                    const ratio = memberRatio?.ratio || 0;
                    const splitAmount = (amount * ratio) / totalRatio;

                    return {
                        householdMemberId: member.id,
                        amount: splitAmount,
                        paid: member.id === defaultPaidBy,
                    };
                });
            }

            const expense = await prisma.expense.create({
                data: {
                    userId,
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
                            householdMemberId: split.householdMemberId,
                            amount: split.amount,
                            paid: split.paid,
                        })),
                    },
                },
                include: {
                    category: true,
                    paidBy: true,
                    splits: {
                        include: {
                            householdMember: true,
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
