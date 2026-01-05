import { prisma } from "@/lib/db";

export function getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

export function getMonthFromDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

export function getPreviousMonth(month: string): string {
    const [year, monthNum] = month.split("-");
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    date.setMonth(date.getMonth() - 1);
    return getMonthFromDate(date);
}

export function getNextMonth(month: string): string {
    const [year, monthNum] = month.split("-");
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    date.setMonth(date.getMonth() + 1);
    return getMonthFromDate(date);
}

export function getNextMonthFromDate(date: Date): string {
    const nextMonthDate = new Date(date);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    return getMonthFromDate(nextMonthDate);
}

export async function getPoolBalance(): Promise<{
    id: string;
    balance: number;
}> {
    let pool = await prisma.poolBalance.findFirst();

    if (!pool) {
        pool = await prisma.poolBalance.create({
            data: {
                balance: 0,
            },
        });
    }

    return pool;
}

async function calculateAllowances(totalIncome: number): Promise<{
    allowances: Array<{ userId: string; amount: number }>;
    totalAllocated: number;
    remainingForPool: number;
}> {
    let configs = await prisma.userAllowanceConfig.findMany({
        where: { isActive: true },
    });

    if (configs.length === 0) {
        const users = await prisma.user.findMany();
        if (users.length > 0) {
            await Promise.all(
                users.map((u) =>
                    prisma.userAllowanceConfig.create({
                        data: {
                            userId: u.id,
                            type: "percentage",
                            value: 0.2,
                            isActive: true,
                        },
                    }),
                ),
            );
            configs = await prisma.userAllowanceConfig.findMany({
                where: { isActive: true },
            });
        } else {
            return {
                allowances: [],
                totalAllocated: 0,
                remainingForPool: totalIncome,
            };
        }
    }

    const percentageConfigs = configs.filter((c) => c.type === "percentage");
    const fixedConfigs = configs.filter((c) => c.type === "fixed");

    let totalAllocated = 0;
    const allowances: Array<{ userId: string; amount: number }> = [];

    for (const config of fixedConfigs) {
        allowances.push({
            userId: config.userId,
            amount: config.value,
        });
        totalAllocated += config.value;
    }

    const remainingAfterFixed = totalIncome - totalAllocated;
    for (const config of percentageConfigs) {
        const amount = remainingAfterFixed * config.value;
        allowances.push({
            userId: config.userId,
            amount,
        });
        totalAllocated += amount;
    }

    return {
        allowances,
        totalAllocated,
        remainingForPool: totalIncome - totalAllocated,
    };
}

async function processCarryover(
    userId: string,
    month: string,
): Promise<number> {
    const previousMonth = getPreviousMonth(month);
    const prevAllowance = await prisma.personalAllowance.findUnique({
        where: {
            userId_month: {
                userId,
                month: previousMonth,
            },
        },
    });

    if (!prevAllowance) {
        return 0;
    }

    const carryover = prevAllowance.remaining;

    if (carryover !== 0) {
        await prisma.personalAllowance.update({
            where: {
                userId_month: {
                    userId,
                    month: previousMonth,
                },
            },
            data: {
                carriedTo: carryover,
            },
        });
    }

    return carryover;
}

export async function processIncomeForSharedPool(
    userId: string,
    amount: number,
    date: Date,
    allocatedToMonth?: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        let month: string;
        if (allocatedToMonth) {
            month = allocatedToMonth;
        } else {
            const dayOfMonth = date.getDate();
            if (dayOfMonth >= 22) {
                month = getNextMonthFromDate(date);
            } else {
                month = getMonthFromDate(date);
            }
        }

        const { allowances, remainingForPool } =
            await calculateAllowances(amount);

        if (allowances.length === 0) {
            return {
                success: false,
                error: "No active user allowance configurations found",
            };
        }

        const pool = await getPoolBalance();
        await prisma.poolBalance.update({
            where: { id: pool.id },
            data: {
                balance: pool.balance + remainingForPool,
            },
        });

        await Promise.all(
            allowances.map(async (allowance) => {
                const carryover = await processCarryover(
                    allowance.userId,
                    month,
                );

                const existing = await prisma.personalAllowance.findUnique({
                    where: {
                        userId_month: {
                            userId: allowance.userId,
                            month,
                        },
                    },
                });

                if (existing) {
                    const newAllocated = existing.allocated + allowance.amount;
                    const newRemaining = existing.remaining + allowance.amount;

                    await prisma.personalAllowance.update({
                        where: {
                            userId_month: {
                                userId: allowance.userId,
                                month,
                            },
                        },
                        data: {
                            allocated: newAllocated,
                            remaining: newRemaining,
                        },
                    });
                } else {
                    const totalRemaining = allowance.amount + carryover;

                    await prisma.personalAllowance.create({
                        data: {
                            userId: allowance.userId,
                            month,
                            allocated: allowance.amount,
                            spent: 0,
                            remaining: totalRemaining,
                            carriedOver: carryover,
                            carriedTo: 0,
                        },
                    });
                }
            }),
        );

        return { success: true };
    } catch (error) {
        console.error("Error processing income for shared pool:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function deductFromSharedPool(
    expenseId: string,
    amount: number,
    _month: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const pool = await getPoolBalance();

        if (pool.balance < amount) {
            return {
                success: false,
                error: `Insufficient pool balance. Available: €${pool.balance.toFixed(2)}, Required: €${amount.toFixed(2)}`,
            };
        }

        await prisma.poolBalance.update({
            where: { id: pool.id },
            data: {
                balance: pool.balance - amount,
            },
        });

        await prisma.expense.update({
            where: { id: expenseId },
            data: {
                paidFromPool: true,
                needsReimbursement: false,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Error deducting from shared pool:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function deductFromPersonalAllowance(
    userId: string,
    amount: number,
    month: string,
): Promise<{ success: boolean; warning?: string; error?: string }> {
    try {
        let allowance = await prisma.personalAllowance.findUnique({
            where: {
                userId_month: {
                    userId,
                    month,
                },
            },
        });

        if (!allowance) {
            const carryover = await processCarryover(userId, month);

            allowance = await prisma.personalAllowance.create({
                data: {
                    userId,
                    month,
                    allocated: 0,
                    spent: 0,
                    remaining: carryover,
                    carriedOver: carryover,
                    carriedTo: 0,
                },
            });
        }

        const newSpent = allowance.spent + amount;
        const newRemaining = allowance.remaining - amount;

        await prisma.personalAllowance.update({
            where: {
                userId_month: {
                    userId,
                    month,
                },
            },
            data: {
                spent: newSpent,
                remaining: newRemaining,
            },
        });

        if (newRemaining < 0) {
            return {
                success: true,
                warning: `Personal allowance exceeded by €${Math.abs(newRemaining).toFixed(2)}`,
            };
        }

        return { success: true };
    } catch (error) {
        console.error("Error deducting from personal allowance:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function createReimbursementForExpense(
    expenseId: string,
    userId: string,
    amount: number,
    description: string,
    month: string,
): Promise<{ success: boolean; reimbursementId?: string; error?: string }> {
    try {
        const reimbursement = await prisma.reimbursement.create({
            data: {
                userId,
                month,
                amount,
                description,
                settled: false,
            },
        });

        await prisma.expense.update({
            where: { id: expenseId },
            data: {
                reimbursementId: reimbursement.id,
                needsReimbursement: true,
                paidFromPool: false,
            },
        });

        return { success: true, reimbursementId: reimbursement.id };
    } catch (error) {
        console.error("Error creating reimbursement:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function settleReimbursement(
    reimbursementId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const reimbursement = await prisma.reimbursement.findUnique({
            where: { id: reimbursementId },
        });

        if (!reimbursement) {
            return { success: false, error: "Reimbursement not found" };
        }

        if (reimbursement.settled) {
            return { success: false, error: "Reimbursement already settled" };
        }

        const pool = await getPoolBalance();

        if (pool.balance < reimbursement.amount) {
            return {
                success: false,
                error: `Insufficient pool balance for reimbursement. Available: €${pool.balance.toFixed(2)}, Required: €${reimbursement.amount.toFixed(2)}`,
            };
        }

        await prisma.poolBalance.update({
            where: { id: pool.id },
            data: {
                balance: pool.balance - reimbursement.amount,
            },
        });

        await prisma.reimbursement.update({
            where: { id: reimbursementId },
            data: {
                settled: true,
                settledAt: new Date(),
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Error settling reimbursement:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function getSharedPoolSummary(month?: string): Promise<{
    pool: {
        balance: number;
        totalIncomeThisMonth: number;
        personalAllocationThisMonth: number;
        totalPoolSpent: number;
    };
    allowances: Array<{
        userId: string;
        userName: string;
        allocated: number;
        spent: number;
        remaining: number;
        carriedOver: number;
        carriedTo: number;
    }>;
    reimbursements: Array<{
        id: string;
        userId: string;
        userName: string;
        amount: number;
        description: string;
        settled: boolean;
        month: string;
    }>;
    totalReimbursementsOwed: number;
}> {
    try {
        const currentMonth = month || getCurrentMonth();

        const pool = await getPoolBalance();

        const incomes = await prisma.income.findMany({
            where: {
                OR: [
                    {
                        allocatedToMonth: currentMonth,
                    },
                    {
                        allocatedToMonth: null,
                        date: {
                            gte: new Date(`${currentMonth}-01`),
                            lt: new Date(
                                new Date(`${currentMonth}-01`).getFullYear(),
                                new Date(`${currentMonth}-01`).getMonth() + 1,
                                1,
                            ),
                        },
                    },
                ],
            },
        });

        const totalIncomeThisMonth = incomes.reduce(
            (sum, i) => sum + i.amount,
            0,
        );

        const allowances = await prisma.personalAllowance.findMany({
            where: { month: currentMonth },
            include: { user: true },
        });

        const personalAllocationThisMonth = allowances.reduce(
            (sum, a) => sum + a.allocated,
            0,
        );

        const reimbursements = await prisma.reimbursement.findMany({
            where: { settled: false },
            include: { user: true },
            orderBy: { createdAt: "desc" },
        });

        const totalReimbursementsOwed = reimbursements.reduce(
            (sum, r) => sum + r.amount,
            0,
        );

        const expensesPaidFromPool = await prisma.expense.findMany({
            where: {
                type: "shared",
                paidFromPool: true,
            },
        });

        const settledReimbursements = await prisma.reimbursement.findMany({
            where: { settled: true },
        });

        const totalPoolSpent =
            expensesPaidFromPool.reduce((sum, e) => sum + e.amount, 0) +
            settledReimbursements.reduce((sum, r) => sum + r.amount, 0);

        return {
            pool: {
                balance: pool.balance,
                totalIncomeThisMonth,
                personalAllocationThisMonth,
                totalPoolSpent,
            },
            allowances: allowances.map((a) => ({
                userId: a.userId,
                userName: a.user.name,
                allocated: a.allocated,
                spent: a.spent,
                remaining: a.remaining,
                carriedOver: a.carriedOver,
                carriedTo: a.carriedTo,
            })),
            reimbursements: reimbursements.map((r) => ({
                id: r.id,
                userId: r.userId,
                userName: r.user.name,
                amount: r.amount,
                description: r.description,
                settled: r.settled,
                month: r.month,
            })),
            totalReimbursementsOwed,
        };
    } catch (error) {
        console.error("Error getting shared pool summary:", error);
        return {
            pool: {
                balance: 0,
                totalIncomeThisMonth: 0,
                personalAllocationThisMonth: 0,
                totalPoolSpent: 0,
            },
            allowances: [],
            reimbursements: [],
            totalReimbursementsOwed: 0,
        };
    }
}
