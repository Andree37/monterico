import { prisma } from "@/lib/db";

export async function calculateIndividualBalances(userId: string): Promise<{
    balances: Array<{
        householdMemberId: string;
        memberName: string;
        netBalance: number;
        owes: Array<{
            householdMemberId: string;
            memberName: string;
            amount: number;
        }>;
        owedBy: Array<{
            householdMemberId: string;
            memberName: string;
            amount: number;
        }>;
    }>;
    error?: string;
}> {
    try {
        // Get all household members for this user with their split ratios
        const members = await prisma.householdMember.findMany({
            where: { userId },
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

        const balances = members.map((member) => {
            let netBalance = 0;
            const owes: Record<
                string,
                {
                    householdMemberId: string;
                    memberName: string;
                    amount: number;
                }
            > = {};
            const owedBy: Record<
                string,
                {
                    householdMemberId: string;
                    memberName: string;
                    amount: number;
                }
            > = {};

            member.expenseSplits.forEach((split) => {
                const expense = split.expense;
                const paidBy = expense.paidBy;

                if (split.paid) {
                    netBalance += split.amount;
                } else {
                    if (paidBy.id !== member.id) {
                        if (!owes[paidBy.id]) {
                            owes[paidBy.id] = {
                                householdMemberId: paidBy.id,
                                memberName: paidBy.name,
                                amount: 0,
                            };
                        }
                        owes[paidBy.id].amount += split.amount;
                        netBalance -= split.amount;
                    }
                }
            });

            members.forEach((otherMember) => {
                if (otherMember.id === member.id) return;

                otherMember.expenseSplits.forEach((split) => {
                    if (split.expense.paidById === member.id && !split.paid) {
                        if (!owedBy[otherMember.id]) {
                            owedBy[otherMember.id] = {
                                householdMemberId: otherMember.id,
                                memberName: otherMember.name,
                                amount: 0,
                            };
                        }
                        owedBy[otherMember.id].amount += split.amount;
                    }
                });
            });

            return {
                householdMemberId: member.id,
                memberName: member.name,
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
    userId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const expense = await prisma.expense.findUnique({
            where: { id: expenseId },
        });

        if (!expense) {
            return { success: false, error: "Expense not found" };
        }

        const members = await prisma.householdMember.findMany({
            where: { userId },
        });

        const splitRatios = await prisma.householdMemberSplitRatio.findMany({
            where: {
                householdMemberId: { in: members.map((m) => m.id) },
            },
        });

        const membersWithRatios = members.map((member) => ({
            ...member,
            splitRatio: splitRatios.find(
                (sr) => sr.householdMemberId === member.id,
            ),
        }));

        const activeMembers = membersWithRatios.filter(
            (m) => m.splitRatio && m.splitRatio.isActive === true,
        );

        if (activeMembers.length === 0) {
            return {
                success: false,
                error: "No active household members found",
            };
        }

        let splits: Array<{
            householdMemberId: string;
            amount: number;
            paid: boolean;
        }> = [];

        if (splitType === "equal") {
            const splitAmount = amount / activeMembers.length;
            splits = activeMembers.map((member) => ({
                householdMemberId: member.id,
                amount: splitAmount,
                paid: member.id === expense.paidById,
            }));
        } else if (splitType === "ratio") {
            console.log("=== RATIO SPLIT DEBUG ===");
            console.log(
                "Active members:",
                activeMembers.map((m) => ({
                    id: m.id,
                    name: m.name,
                    ratio: m.splitRatio?.ratio,
                })),
            );

            const totalRatio = activeMembers.reduce(
                (sum, member) => sum + (member.splitRatio?.ratio || 0),
                0,
            );

            console.log("Total ratio:", totalRatio);

            if (totalRatio === 0) {
                return { success: false, error: "Total ratio is zero" };
            }

            splits = activeMembers.map((member) => {
                const memberRatio = member.splitRatio?.ratio || 0;
                const splitAmount = (amount * memberRatio) / totalRatio;
                console.log(
                    `Member ${member.name}: ratio=${memberRatio}, amount=${splitAmount}`,
                );
                return {
                    householdMemberId: member.id,
                    amount: splitAmount,
                    paid: member.id === expense.paidById,
                };
            });

            console.log("Final splits:", splits);
        } else if (splitType === "custom") {
            return {
                success: false,
                error: "Custom splits not yet implemented for household members",
            };
        } else {
            return { success: false, error: "Invalid split type" };
        }

        if (splits.length === 0) {
            return { success: false, error: "No splits generated" };
        }

        await prisma.expenseSplit.deleteMany({
            where: { expenseId },
        });

        await Promise.all(
            splits.map((split) =>
                prisma.expenseSplit.create({
                    data: {
                        expenseId,
                        householdMemberId: split.householdMemberId,
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
    householdMemberId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.expenseSplit.updateMany({
            where: {
                expenseId,
                householdMemberId,
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

export async function getMemberBalance(householdMemberId: string): Promise<{
    totalOwed: number;
    totalOwing: number;
    netBalance: number;
    details: Array<{
        expenseId: string;
        description: string;
        amount: number;
        date: Date;
        type: "owes" | "owed";
        otherMember: string;
    }>;
    error?: string;
}> {
    try {
        const splits = await prisma.expenseSplit.findMany({
            where: {
                OR: [
                    { householdMemberId, paid: false },
                    {
                        expense: {
                            paidById: householdMemberId,
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
                householdMember: true,
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
            otherMember: string;
        }> = [];

        splits.forEach((split) => {
            if (split.householdMemberId === householdMemberId && !split.paid) {
                totalOwing += split.amount;
                details.push({
                    expenseId: split.expenseId,
                    description: split.expense.description,
                    amount: split.amount,
                    date: split.expense.date,
                    type: "owes",
                    otherMember: split.expense.paidBy.name,
                });
            } else if (
                split.expense.paidById === householdMemberId &&
                !split.paid
            ) {
                totalOwed += split.amount;
                details.push({
                    expenseId: split.expenseId,
                    description: split.expense.description,
                    amount: split.amount,
                    date: split.expense.date,
                    type: "owed",
                    otherMember: split.householdMember.name,
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
    memberAId: string,
    memberBId: string,
): Promise<{ success: boolean; amountSettled: number; error?: string }> {
    try {
        const splits = await prisma.expenseSplit.findMany({
            where: {
                OR: [
                    {
                        householdMemberId: memberAId,
                        expense: { paidById: memberBId },
                        paid: false,
                    },
                    {
                        householdMemberId: memberBId,
                        expense: { paidById: memberAId },
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
