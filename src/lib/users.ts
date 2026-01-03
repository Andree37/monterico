import { User } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface UserWithRatio extends User {
    ratio: number;
    isActive: boolean;
}

/**
 * Get all active users with their split ratios
 */
export async function getActiveUsers(): Promise<UserWithRatio[]> {
    const users = await prisma.user.findMany({
        orderBy: {
            createdAt: "asc",
        },
    });

    const usersWithRatios = await Promise.all(
        users.map(async (user) => {
            const splitRatio = await prisma.userSplitRatio.findUnique({
                where: { userId: user.id },
            });

            return {
                ...user,
                ratio: splitRatio?.ratio || 0.5,
                isActive: splitRatio?.isActive ?? true,
            };
        }),
    );

    // Filter only active users
    return usersWithRatios.filter((user) => user.isActive);
}

/**
 * Get all users (including inactive) with their split ratios
 */
export async function getAllUsers(): Promise<UserWithRatio[]> {
    const users = await prisma.user.findMany({
        orderBy: {
            createdAt: "asc",
        },
    });

    const usersWithRatios = await Promise.all(
        users.map(async (user) => {
            const splitRatio = await prisma.userSplitRatio.findUnique({
                where: { userId: user.id },
            });

            return {
                ...user,
                ratio: splitRatio?.ratio || 0.5,
                isActive: splitRatio?.isActive ?? true,
            };
        }),
    );

    return usersWithRatios;
}

/**
 * Get a user by ID with their ratio
 */
export async function getUserById(
    userId: string,
): Promise<UserWithRatio | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        return null;
    }

    const splitRatio = await prisma.userSplitRatio.findUnique({
        where: { userId: user.id },
    });

    return {
        ...user,
        ratio: splitRatio?.ratio || 0.5,
        isActive: splitRatio?.isActive ?? true,
    };
}

/**
 * Calculate expense splits based on user ratios
 */
export async function calculateExpenseSplits(
    amount: number,
    splitType: "equal" | "ratio" | "custom" = "equal",
    customSplits?: { userId: string; amount: number }[],
): Promise<{ userId: string; amount: number }[]> {
    if (splitType === "custom" && customSplits) {
        return customSplits;
    }

    const activeUsers = await getActiveUsers();

    if (activeUsers.length === 0) {
        throw new Error("No active users found");
    }

    if (splitType === "equal") {
        const splitAmount = amount / activeUsers.length;
        return activeUsers.map((user) => ({
            userId: user.id,
            amount: splitAmount,
        }));
    }

    // splitType === "ratio"
    const totalRatio = activeUsers.reduce((sum, user) => sum + user.ratio, 0);

    if (totalRatio === 0) {
        throw new Error("Total ratio is zero");
    }

    return activeUsers.map((user) => ({
        userId: user.id,
        amount: (amount * user.ratio) / totalRatio,
    }));
}

/**
 * Normalize ratios to ensure they sum to 1.0
 */
export function normalizeRatios(
    userRatios: { userId: string; ratio: number }[],
): { userId: string; ratio: number }[] {
    const totalRatio = userRatios.reduce((sum, ur) => sum + ur.ratio, 0);

    if (totalRatio === 0) {
        // If all ratios are 0, distribute equally
        const equalRatio = 1.0 / userRatios.length;
        return userRatios.map((ur) => ({
            ...ur,
            ratio: equalRatio,
        }));
    }

    return userRatios.map((ur) => ({
        ...ur,
        ratio: ur.ratio / totalRatio,
    }));
}

/**
 * Get user statistics for balances and spending
 */
export async function getUserStatistics(
    userId: string,
    startDate?: Date,
    endDate?: Date,
) {
    const whereClause: {
        splits: { some: { userId: string } };
        date?: { gte?: Date; lte?: Date };
    } = {
        splits: {
            some: {
                userId: userId,
            },
        },
    };

    if (startDate || endDate) {
        whereClause.date = {};
        if (startDate) whereClause.date.gte = startDate;
        if (endDate) whereClause.date.lte = endDate;
    }

    const expenses = await prisma.expense.findMany({
        where: whereClause,
        include: {
            splits: true,
            category: true,
        },
    });

    const totalSpent = expenses.reduce((sum, expense) => {
        const userSplit = expense.splits.find((s) => s.userId === userId);
        return sum + (userSplit?.amount || 0);
    }, 0);

    const totalPaid = expenses
        .filter((e) => e.paidById === userId)
        .reduce((sum, expense) => sum + expense.amount, 0);

    const balance = totalPaid - totalSpent;

    return {
        totalSpent,
        totalPaid,
        balance,
        expenseCount: expenses.length,
    };
}
