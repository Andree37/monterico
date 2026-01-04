import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

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
            // If month is provided (e.g., "2025-01"), filter by that month
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
            where.date = {
                gte: startOfMonth,
                lte: endOfMonth,
            };
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
        const body = await request.json();
        const {
            id,
            userId,
            date,
            description,
            amount,
            currency,
            type,
            allocatedToMonth,
        } = body;

        if (!userId || !date || !amount || !type) {
            return NextResponse.json(
                { error: "Missing required fields" },
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
                            name: true,
                        },
                    },
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
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Missing income ID" },
                { status: 400 },
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
