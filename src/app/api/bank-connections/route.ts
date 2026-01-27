import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireBankOperationMfa } from "@/lib/session";

export async function GET() {
    try {
        const bankConnections = await prisma.bankConnection.findMany({
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
                        accountType: true,
                        ownerId: true,
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

export async function PUT(request: NextRequest) {
    try {
        const mfaCheck = await requireBankOperationMfa();
        if ("error" in mfaCheck) {
            return NextResponse.json(
                { error: mfaCheck.error, code: mfaCheck.code },
                { status: mfaCheck.status },
            );
        }

        const body = await request.json();
        const { id, userId } = body;

        if (!id || !userId) {
            return NextResponse.json(
                { error: "Missing bank connection ID or user ID" },
                { status: 400 },
            );
        }

        const bankConnection = await prisma.bankConnection.update({
            where: { id },
            data: { userId },
        });

        return NextResponse.json({
            success: true,
            bankConnection,
        });
    } catch (error: unknown) {
        console.error("Error updating bank connection:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const mfaCheck = await requireBankOperationMfa();
        if ("error" in mfaCheck) {
            return NextResponse.json(
                { error: mfaCheck.error, code: mfaCheck.code },
                { status: mfaCheck.status },
            );
        }

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
