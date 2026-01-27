import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/session";

export async function POST(request: NextRequest) {
    try {
        const { userId } = await getAuthenticatedUser();
        const body = await request.json();

        const { accountId, accountType, ownerId } = body;

        if (!accountId || !accountType) {
            return NextResponse.json(
                { error: "accountId and accountType are required" },
                { status: 400 },
            );
        }

        if (accountType !== "personal" && accountType !== "joint") {
            return NextResponse.json(
                { error: "accountType must be 'personal' or 'joint'" },
                { status: 400 },
            );
        }

        if (accountType === "personal" && !ownerId) {
            return NextResponse.json(
                { error: "ownerId is required for personal accounts" },
                { status: 400 },
            );
        }

        // Verify the account belongs to this user's bank connection
        const account = await prisma.bankAccount.findFirst({
            where: {
                id: accountId,
                bankConnection: {
                    userId: userId,
                },
            },
            include: {
                bankConnection: true,
            },
        });

        if (!account) {
            return NextResponse.json(
                { error: "Account not found or does not belong to you" },
                { status: 404 },
            );
        }

        // Update the account with type and owner
        const updatedAccount = await prisma.bankAccount.update({
            where: { id: account.id },
            data: {
                accountType,
                ownerId: accountType === "personal" ? ownerId : null,
            },
        });

        return NextResponse.json({
            success: true,
            account: updatedAccount,
        });
    } catch (error) {
        console.error("Error tagging account:", error);
        return NextResponse.json(
            { error: "Failed to tag account" },
            { status: 500 },
        );
    }
}
