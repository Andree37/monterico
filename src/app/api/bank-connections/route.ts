import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId") || "default_user";

        const bankConnections = await prisma.bankConnection.findMany({
            where: { userId },
            include: {
                accounts: {
                    select: {
                        id: true,
                        accountId: true,
                        name: true,
                        type: true,
                        subtype: true,
                        currentBalance: true,
                        availableBalance: true,
                        currency: true,
                    },
                },
                _count: {
                    select: {
                        transactions: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({
            success: true,
            bankConnections,
            count: bankConnections.length,
        });
    } catch (error: unknown) {
        console.error("Error fetching bank connections:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const bankConnectionId = searchParams.get("id");

        if (!bankConnectionId) {
            return NextResponse.json(
                { error: "Missing bank connection ID" },
                { status: 400 },
            );
        }

        await prisma.bankConnection.delete({
            where: { id: bankConnectionId },
        });

        return NextResponse.json({
            success: true,
            message: "Bank connection deleted",
        });
    } catch (error: unknown) {
        console.error("Error deleting bank connection:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
