import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/session";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
    try {
        const { userId } = await getAuthenticatedUser();
        const { searchParams } = new URL(request.url);
        const unlinkedOnly = searchParams.get("unlinked") === "true";

        const where: Prisma.TransactionWhereInput = {
            bankConnection: {
                userId,
            },
        };

        // If we only want unlinked transactions
        if (unlinkedOnly) {
            where.transactionInLinks = {
                none: {},
            };
        }

        const transactions = await prisma.transaction.findMany({
            where,
            include: {
                account: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        accountType: true,
                    },
                },
                bankConnection: {
                    select: {
                        institutionName: true,
                    },
                },
                transactionInLinks: {
                    include: {
                        link: true,
                    },
                },
            },
            orderBy: {
                date: "desc",
            },
        });

        return NextResponse.json({
            success: true,
            transactions,
        });
    } catch (error) {
        console.error("Error fetching transactions:", error);
        return NextResponse.json(
            { error: "Failed to fetch transactions" },
            { status: 500 },
        );
    }
}
