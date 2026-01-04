import { prisma } from "@/lib/db";

export async function calculateIndividualBalances(): Promise<{
    balances: Array<{
        userId: string;
        userName: string;
        netBalance: number;
        owes: Array<{ userId: string; userName: string; amount: number }>;
        owedBy: Array<{ userId: string; userName: string; amount: number }>;
    }>;
    error?: string;
}> {
    try {
        // Get all users with their split ratios
        const users = await prisma.user.findMany({
            include: {
                expenseSplits: {
                    include: {
                        expense: {
                            include: {
                                paidBy: true,
                            },
                        },
                    },
                },
            },
        });

        const balances = users.map((user) => {
            let netBalance = 0;
            const owes: Record<
                string,
                { userId: string; userName: string; amount: number }
            > = {};
            const owedBy: Record<
                string,
                { userId: string; userName: string; amount: number }
            > = {};

            user.expenseSplits.forEach((split) => {
                const expense = split.expense;
                const paidBy = expense.paidBy;

                if (split.paid) {
                    netBalance += split.amount;
                } else {
                    if (paidBy.id !== user.id) {
                        if (!owes[paidBy.id]) {
                            owes[paidBy.id] = {
                                userId: paidBy.id,
                                userName: paidBy.name,
                                amount: 0,
                            };
                        }
                        owes[paidBy.id].amount += split.amount;
                        netBalance -= split.amount;
                    }
                }
            });

            users.forEach((otherUser) => {
                if (otherUser.id === user.id) return;

                otherUser.expenseSplits.forEach((split) => {
                    if (split.expense.paidById === user.id && !split.paid) {
                        if (!owedBy[otherUser.id]) {
                            owedBy[otherUser.id] = {
                                userId: otherUser.id,
                                userName: otherUser.name,
                                amount: 0,
                            };
                        }
                        owedBy[otherUser.id].amount += split.amount;
                    }
                });
            });

            return {
                userId: user.id,
                userName: user.name,
                netBalance,
                owes: Object.values(owes),
                owedBy: Object.values(owedBy),
            };
        });

        return { balances };
    } catch (error) {
        console.error("Error calculating individual balances:", error);
        return {
            balances: [],
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function createExpenseSplits(
    expenseId: string,
    amount: number,
    splitType: string,
    customSplits?: Array<{ userId: string; amount: number }>,
): Promise<{ success: boolean; error?: string }> {
    try {
        const expense = await prisma.expense.findUnique({
            where: { id: expenseId },
        });

        if (!expense) {
            return { success: false, error: "Expense not found" };
        }

        const users = await prisma.user.findMany();

        const splitRatios = await prisma.userSplitRatio.findMany({
            where: {
                userId: { in: users.map((u) => u.id) },
            },
        });

        const usersWithRatios = users.map((user) => ({
            ...user,
            userSplitRatio: splitRatios.find((sr) => sr.userId === user.id),
        }));

        const activeUsers = usersWithRatios.filter(
            (u) => u.userSplitRatio?.isActive !== false,
        );

        if (activeUsers.length === 0) {
            return { success: false, error: "No active users found" };
        }

        let splits: Array<{ userId: string; amount: number; paid: boolean }> =
            [];

        if (splitType === "equal") {
            const splitAmount = amount / activeUsers.length;
            splits = activeUsers.map((user) => ({
                userId: user.id,
                amount: splitAmount,
                paid: user.id === expense.paidById,
            }));
        } else if (splitType === "ratio") {
            const totalRatio = activeUsers.reduce(
                (sum, user) => sum + (user.userSplitRatio?.ratio || 0),
                0,
            );

            if (totalRatio === 0) {
                return { success: false, error: "Total ratio is zero" };
            }

            splits = activeUsers.map((user) => ({
                userId: user.id,
                amount:
                    (amount * (user.userSplitRatio?.ratio || 0)) / totalRatio,
                paid: user.id === expense.paidById,
            }));
        } else if (splitType === "custom" && customSplits) {
            splits = customSplits.map((split) => ({
                userId: split.userId,
                amount: split.amount,
                paid: split.userId === expense.paidById,
            }));
        } else {
            return { success: false, error: "Invalid split type" };
        }

        await Promise.all(
            splits.map((split) =>
                prisma.expenseSplit.create({
                    data: {
                        expenseId,
                        userId: split.userId,
                        amount: split.amount,
                        paid: split.paid,
                    },
                }),
            ),
        );

        return { success: true };
    } catch (error) {
        console.error("Error creating expense splits:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function markSplitAsPaid(
    expenseId: string,
    userId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.expenseSplit.updateMany({
            where: {
                expenseId,
                userId,
            },
            data: {
                paid: true,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Error marking split as paid:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function getUserBalance(userId: string): Promise<{
    totalOwed: number;
    totalOwing: number;
    netBalance: number;
    details: Array<{
        expenseId: string;
        description: string;
        amount: number;
        date: Date;
        type: "owes" | "owed";
        otherUser: string;
    }>;
    error?: string;
}> {
    try {
        const splits = await prisma.expenseSplit.findMany({
            where: {
                OR: [
                    { userId, paid: false },
                    {
                        expense: {
                            paidById: userId,
                        },
                        paid: false,
                    },
                ],
            },
            include: {
                expense: {
                    include: {
                        paidBy: true,
                    },
                },
                user: true,
            },
        });

        let totalOwed = 0;
        let totalOwing = 0;
        const details: Array<{
            expenseId: string;
            description: string;
            amount: number;
            date: Date;
            type: "owes" | "owed";
            otherUser: string;
        }> = [];

        splits.forEach((split) => {
            if (split.userId === userId && !split.paid) {
                totalOwing += split.amount;
                details.push({
                    expenseId: split.expenseId,
                    description: split.expense.description,
                    amount: split.amount,
                    date: split.expense.date,
                    type: "owes",
                    otherUser: split.expense.paidBy.name,
                });
            } else if (split.expense.paidById === userId && !split.paid) {
                totalOwed += split.amount;
                details.push({
                    expenseId: split.expenseId,
                    description: split.expense.description,
                    amount: split.amount,
                    date: split.expense.date,
                    type: "owed",
                    otherUser: split.user.name,
                });
            }
        });

        const netBalance = totalOwed - totalOwing;

        return {
            totalOwed,
            totalOwing,
            netBalance,
            details,
        };
    } catch (error) {
        console.error("Error getting user balance:", error);
        return {
            totalOwed: 0,
            totalOwing: 0,
            netBalance: 0,
            details: [],
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function settleDebts(
    userAId: string,
    userBId: string,
): Promise<{ success: boolean; amountSettled: number; error?: string }> {
    try {
        const splits = await prisma.expenseSplit.findMany({
            where: {
                OR: [
                    {
                        userId: userAId,
                        expense: { paidById: userBId },
                        paid: false,
                    },
                    {
                        userId: userBId,
                        expense: { paidById: userAId },
                        paid: false,
                    },
                ],
            },
        });

        let amountSettled = 0;

        await Promise.all(
            splits.map(async (split) => {
                amountSettled += split.amount;
                await prisma.expenseSplit.update({
                    where: { id: split.id },
                    data: { paid: true },
                });
            }),
        );

        return { success: true, amountSettled };
    } catch (error) {
        console.error("Error settling debts:", error);
        return {
            success: false,
            amountSettled: 0,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
