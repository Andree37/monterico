import { prisma } from "@/lib/db";

// Utility functions for date/month handling
function getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function getMonthFromDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function getPreviousMonth(monthStr: string): string {
    const [year, month] = monthStr.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() - 1);
    return getMonthFromDate(date);
}

function getNextMonth(monthStr: string): string {
    const [year, month] = monthStr.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + 1);
    return getMonthFromDate(date);
}

// Pure calculation functions - no state mutations

/**
 * Calculate how much each user should get from an income amount
 */
async function calculateAllowanceDistribution(
    totalIncome: number,
    userId: string,
): Promise<{
    allowances: Array<{
        householdMemberId: string;
        memberName: string | null;
        amount: number;
    }>;
    totalAllocated: number;
    remainingForPool: number;
}> {
    const configs = await prisma.householdMemberAllowanceConfig.findMany({
        where: {
            isActive: true,
            householdMember: {
                userId: userId,
            },
        },
        include: {
            householdMember: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    if (configs.length === 0) {
        return {
            allowances: [],
            totalAllocated: 0,
            remainingForPool: totalIncome,
        };
    }

    const percentageConfigs = configs.filter((c) => c.type === "percentage");
    const fixedConfigs = configs.filter((c) => c.type === "fixed");

    let totalAllocated = 0;
    const allowances: Array<{
        householdMemberId: string;
        memberName: string | null;
        amount: number;
    }> = [];

    // First allocate fixed amounts
    for (const config of fixedConfigs) {
        const amount = config.value;
        allowances.push({
            householdMemberId: config.householdMemberId,
            memberName: config.householdMember.name,
            amount,
        });
        totalAllocated += amount;
    }

    // Then allocate percentages from remaining amount
    const remainingAfterFixed = totalIncome - totalAllocated;
    for (const config of percentageConfigs) {
        const amount = remainingAfterFixed * config.value;
        allowances.push({
            householdMemberId: config.householdMemberId,
            memberName: config.householdMember.name,
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

/**
 * Calculate total personal allowance allocated for a household member in a month
 */
async function calculatePersonalAllowanceAllocated(
    householdMemberId: string,
    month: string,
    userId: string,
): Promise<number> {
    const incomes = await prisma.income.findMany({
        where: {
            userId,
            allocatedToMonth: month,
        },
    });

    const config = await prisma.householdMemberAllowanceConfig.findUnique({
        where: { householdMemberId },
    });

    if (!config || !config.isActive) {
        return 0;
    }

    let totalAllocated = 0;

    for (const income of incomes) {
        const distribution = await calculateAllowanceDistribution(
            income.amount,
            userId,
        );
        const memberAllowance = distribution.allowances.find(
            (a) => a.householdMemberId === householdMemberId,
        );
        if (memberAllowance) {
            totalAllocated += memberAllowance.amount;
        }
    }

    return totalAllocated;
}

/**
 * Calculate total personal allowance spent by a household member in a month
 */
async function calculatePersonalAllowanceSpent(
    householdMemberId: string,
    month: string,
    userId: string,
): Promise<number> {
    const expenses = await prisma.expense.findMany({
        where: {
            userId,
            paidById: householdMemberId,
            type: "personal",
            date: {
                gte: new Date(`${month}-01`),
                lte: new Date(`${month}-31`),
            },
        },
    });

    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

/**
 * Calculate carryover from previous month for a household member
 */
async function calculateCarryover(
    householdMemberId: string,
    month: string,
    userId: string,
): Promise<number> {
    const previousMonth = getPreviousMonth(month);

    const previousAllocated = await calculatePersonalAllowanceAllocated(
        householdMemberId,
        previousMonth,
        userId,
    );
    const previousSpent = await calculatePersonalAllowanceSpent(
        householdMemberId,
        previousMonth,
        userId,
    );

    const carryover = previousAllocated - previousSpent;
    return carryover > 0 ? carryover : 0;
}

/**
 * Calculate the current pool balance
 */
export async function calculatePoolBalance(userId: string): Promise<number> {
    // Get all income
    const incomes = await prisma.income.findMany({
        where: { userId },
    });
    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);

    // Get all personal allowances allocated
    let totalPersonalAllocated = 0;
    for (const income of incomes) {
        const distribution = await calculateAllowanceDistribution(
            income.amount,
            userId,
        );
        totalPersonalAllocated += distribution.totalAllocated;
    }

    // Get all expenses paid from pool
    const poolExpenses = await prisma.expense.findMany({
        where: {
            userId,
            paidFromPool: true,
        },
    });
    const totalPoolExpenses = poolExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
    );

    return totalIncome - totalPersonalAllocated - totalPoolExpenses;
}

/**
 * Calculate pool balance for a specific month
 */
export async function calculatePoolBalanceForMonth(
    month: string,
    userId: string,
): Promise<number> {
    // Get income allocated to this month
    const incomes = await prisma.income.findMany({
        where: {
            userId,
            allocatedToMonth: month,
        },
    });
    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);

    // Get personal allowances for this month
    let totalPersonalAllocated = 0;
    for (const income of incomes) {
        const distribution = await calculateAllowanceDistribution(
            income.amount,
            userId,
        );
        totalPersonalAllocated += distribution.totalAllocated;
    }

    // Get expenses paid from pool in this month
    const [year, monthNum] = month.split("-").map(Number);
    const startOfMonth = new Date(year, monthNum - 1, 1);
    const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59);

    const poolExpenses = await prisma.expense.findMany({
        where: {
            userId,
            paidFromPool: true,
            date: {
                gte: startOfMonth,
                lte: endOfMonth,
            },
        },
    });
    const totalPoolExpenses = poolExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
    );

    return totalIncome - totalPersonalAllocated - totalPoolExpenses;
}

/**
 * Get comprehensive shared pool summary for a specific month
 */
export async function getSharedPoolSummary(
    month: string,
    userId: string,
): Promise<{
    month: string;
    // Monthly metrics
    totalIncome: number;
    totalPoolExpenses: number;
    totalPersonalExpenses: number;
    poolBalance: number;
    amountToPool: number;
    amountToAllowances: number;
    // Cumulative metrics
    cumulativePoolBalance: number;
    cumulativeTotalPoolSpent: number;
    cumulativeTotalAllowancesAllocated: number;
    cumulativeTotalAllowancesSpent: number;
    memberAllowances: Array<{
        householdMemberId: string;
        memberName: string | null;
        allocated: number;
        spent: number;
        remaining: number;
        carriedOver: number;
        carriedTo: number;
        cumulativeAllocated: number;
        cumulativeSpent: number;
        cumulativeSaved: number;
    }>;
    pendingReimbursements: Array<{
        id: string;
        householdMemberId: string;
        memberName: string | null;
        amount: number;
        description: string;
        settled: boolean;
        month: string;
    }>;
}> {
    // Get all income for this month (scoped to user)
    const incomes = await prisma.income.findMany({
        where: {
            userId,
            allocatedToMonth: month,
        },
        include: {
            user: {
                select: {
                    id: true,
                },
            },
            householdMember: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);

    // Get expenses for this month
    const [year, monthNum] = month.split("-").map(Number);
    const startOfMonth = new Date(year, monthNum - 1, 1);
    const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59);

    const expenses = await prisma.expense.findMany({
        where: {
            userId,
            date: {
                gte: startOfMonth,
                lte: endOfMonth,
            },
        },
        include: {
            paidBy: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    const poolExpenses = expenses.filter((e) => e.paidFromPool);
    const personalExpenses = expenses.filter((e) => e.type === "personal");

    const totalPoolExpenses = poolExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
    );
    const totalPersonalExpenses = personalExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
    );

    // Calculate household member allowances
    const members = await prisma.householdMember.findMany({
        where: { userId },
        include: {
            allowanceConfig: {
                where: {
                    isActive: true,
                },
            },
        },
    });

    const memberAllowances = await Promise.all(
        members
            .filter((m) => m.allowanceConfig)
            .map(async (member) => {
                const allocated = await calculatePersonalAllowanceAllocated(
                    member.id,
                    month,
                    userId,
                );
                const spent = await calculatePersonalAllowanceSpent(
                    member.id,
                    month,
                    userId,
                );
                const carriedOver = await calculateCarryover(
                    member.id,
                    month,
                    userId,
                );
                const remaining = allocated + carriedOver - spent;

                // Calculate carryover to next month
                const nextMonth = getNextMonth(month);
                const nextMonthSpent = await calculatePersonalAllowanceSpent(
                    member.id,
                    nextMonth,
                    userId,
                );
                const carriedTo =
                    remaining > 0 ? Math.min(remaining, nextMonthSpent) : 0;

                return {
                    householdMemberId: member.id,
                    memberName: member.name,
                    allocated,
                    spent,
                    remaining,
                    carriedOver,
                    carriedTo,
                };
            }),
    );

    // Get pending reimbursements
    const reimbursements = await prisma.reimbursement.findMany({
        where: {
            userId,
            month,
        },
        include: {
            householdMember: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    const pendingReimbursements = reimbursements.map((r) => ({
        id: r.id,
        householdMemberId: r.householdMemberId,
        memberName: r.householdMember.name,
        amount: r.amount,
        description: r.description,
        settled: r.settled,
        month: r.month,
    }));

    const poolBalance = await calculatePoolBalanceForMonth(month, userId);

    // Calculate cumulative metrics
    const cumulativePoolBalance = await calculatePoolBalance(userId);

    // Calculate all-time pool expenses
    const allPoolExpenses = await prisma.expense.findMany({
        where: {
            userId,
            paidFromPool: true,
        },
    });
    const cumulativeTotalPoolSpent = allPoolExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
    );

    // Calculate total allowances allocated to pool this month
    const amountToAllowances = memberAllowances.reduce(
        (sum, a) => sum + a.allocated,
        0,
    );
    const amountToPool = totalIncome - amountToAllowances;

    // Calculate cumulative allowances metrics
    const allIncomes = await prisma.income.findMany({
        where: { userId },
    });

    let cumulativeTotalAllowancesAllocated = 0;
    for (const income of allIncomes) {
        const distribution = await calculateAllowanceDistribution(
            income.amount,
            userId,
        );
        cumulativeTotalAllowancesAllocated += distribution.totalAllocated;
    }

    // Calculate cumulative spent for each member
    const allPersonalExpenses = await prisma.expense.findMany({
        where: {
            userId,
            type: "personal",
        },
    });
    const cumulativeTotalAllowancesSpent = allPersonalExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
    );

    // Add cumulative data to member allowances
    const memberAllowancesWithCumulative = await Promise.all(
        memberAllowances.map(async (allowance) => {
            // Calculate cumulative allocated for this member
            let cumulativeAllocated = 0;
            for (const income of allIncomes) {
                const distribution = await calculateAllowanceDistribution(
                    income.amount,
                    userId,
                );
                const memberAllowance = distribution.allowances.find(
                    (a) => a.householdMemberId === allowance.householdMemberId,
                );
                if (memberAllowance) {
                    cumulativeAllocated += memberAllowance.amount;
                }
            }

            // Calculate cumulative spent for this member
            const memberExpenses = allPersonalExpenses.filter(
                (e) => e.paidById === allowance.householdMemberId,
            );
            const cumulativeSpent = memberExpenses.reduce(
                (sum, expense) => sum + expense.amount,
                0,
            );

            const cumulativeSaved = cumulativeAllocated - cumulativeSpent;

            return {
                ...allowance,
                cumulativeAllocated,
                cumulativeSpent,
                cumulativeSaved,
            };
        }),
    );

    return {
        month,
        totalIncome,
        totalPoolExpenses,
        totalPersonalExpenses,
        poolBalance,
        amountToPool,
        amountToAllowances,
        cumulativePoolBalance,
        cumulativeTotalPoolSpent,
        cumulativeTotalAllowancesAllocated,
        cumulativeTotalAllowancesSpent,
        memberAllowances: memberAllowancesWithCumulative,
        pendingReimbursements,
    };
}

/**
 * Create a reimbursement for an expense
 */
export async function createReimbursementForExpense(
    expenseId: string,
    householdMemberId: string,
    amount: number,
): Promise<{
    success: boolean;
    error?: string;
    reimbursement?: {
        id: string;
        userId: string;
        month: string;
        amount: number;
        description: string;
        settled: boolean;
    };
}> {
    try {
        const expense = await prisma.expense.findUnique({
            where: { id: expenseId },
        });

        if (!expense) {
            return { success: false, error: "Expense not found" };
        }

        const month = getMonthFromDate(expense.date);

        const reimbursement = await prisma.reimbursement.create({
            data: {
                userId: expense.userId,
                householdMemberId,
                month,
                amount,
                description: `Reimbursement for ${expense.description}`,
                settled: false,
            },
        });

        await prisma.expense.update({
            where: { id: expenseId },
            data: {
                needsReimbursement: true,
                reimbursementId: reimbursement.id,
            },
        });

        return { success: true, reimbursement };
    } catch (error) {
        console.error("Error creating reimbursement:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Settle a reimbursement
 */
export async function settleReimbursement(
    reimbursementId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
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

/**
 * Get personal allowance details for a household member in a specific month
 */
export async function getPersonalAllowanceForMember(
    householdMemberId: string,
    month: string,
    userId: string,
): Promise<{
    householdMemberId: string;
    month: string;
    allocated: number;
    spent: number;
    remaining: number;
    carriedOver: number;
}> {
    const allocated = await calculatePersonalAllowanceAllocated(
        householdMemberId,
        month,
        userId,
    );
    const spent = await calculatePersonalAllowanceSpent(
        householdMemberId,
        month,
        userId,
    );
    const carriedOver = await calculateCarryover(
        householdMemberId,
        month,
        userId,
    );
    const remaining = allocated + carriedOver - spent;

    return {
        householdMemberId,
        month,
        allocated,
        spent,
        remaining,
        carriedOver,
    };
}

export { getCurrentMonth, getMonthFromDate, getPreviousMonth, getNextMonth };
