import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getAuthenticatedUser } from "@/lib/session";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const month = searchParams.get("month"); // YYYY-MM format

        const where: Prisma.IncomeWhereInput = {};

        if (userId) {
            where.userId = userId;
        }

        if (month) {
            // Filter by allocatedToMonth if set, otherwise by date
            where.OR = [
                {
                    // Income with allocatedToMonth matching the requested month
                    allocatedToMonth: month,
                },
                {
                    // Income without allocatedToMonth, filter by date
                    allocatedToMonth: null,
                    date: (() => {
                        const [year, monthNum] = month.split("-");
                        const startOfMonth = new Date(
                            parseInt(year),
                            parseInt(monthNum) - 1,
                            1,
                        );
                        const endOfMonth = new Date(
                            parseInt(year),
                            parseInt(monthNum),
                            0,
                            23,
                            59,
                            59,
                        );
                        return {
                            gte: startOfMonth,
                            lte: endOfMonth,
                        };
                    })(),
                },
            ];
        } else if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }

        const incomes = await prisma.income.findMany({
            where,
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
            orderBy: { date: "desc" },
        });

        return NextResponse.json({
            success: true,
            incomes,
            count: incomes.length,
        });
    } catch (error: unknown) {
        console.error("Error fetching incomes:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await getAuthenticatedUser();
        const body = await request.json();
        const {
            id,
            householdMemberId,
            date,
            description,
            amount,
            currency,
            type,
            allocatedToMonth,
            transactionId,
        } = body;

        if (!householdMemberId || !date || !amount || !type) {
            return NextResponse.json(
                {
                    error: "Missing required fields: householdMemberId, date, amount, type",
                },
                { status: 400 },
            );
        }

        let income;

        if (id) {
            // Update existing income
            income = await prisma.income.update({
                where: { id },
                data: {
                    userId,
                    householdMemberId,
                    date: new Date(date),
                    allocatedToMonth: allocatedToMonth || null,
                    description: description || `${type} - ${date.slice(0, 7)}`,
                    amount: parseFloat(amount),
                    currency: currency || "EUR",
                    type,
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
        } else {
            // Create new income
            income = await prisma.income.create({
                data: {
                    userId,
                    householdMemberId,
                    date: new Date(date),
                    allocatedToMonth: allocatedToMonth || null,
                    description: description || `${type} - ${date.slice(0, 7)}`,
                    amount: parseFloat(amount),
                    currency: currency || "EUR",
                    type,
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
        }

        // Link transaction if transactionId is provided
        if (transactionId) {
            await prisma.transaction.updateMany({
                where: { transactionId },
                data: {
                    linkedToIncome: true,
                    incomeId: income.id,
                },
            });
        }

        return NextResponse.json({
            success: true,
            income,
        });
    } catch (error: unknown) {
        console.error("Error creating/updating income:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { userId } = await getAuthenticatedUser();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Missing income ID" },
                { status: 400 },
            );
        }

        // Verify the income belongs to the current user
        const income = await prisma.income.findUnique({
            where: { id },
        });

        if (!income) {
            return NextResponse.json(
                { error: "Income not found" },
                { status: 404 },
            );
        }

        if (income.userId !== userId) {
            return NextResponse.json(
                { error: "Unauthorized to delete this income" },
                { status: 403 },
            );
        }

        await prisma.income.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "Income deleted",
        });
    } catch (error: unknown) {
        console.error("Error deleting income:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
