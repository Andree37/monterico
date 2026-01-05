import { NextRequest, NextResponse } from "next/server";
import { createEnableBankingClient } from "@/lib/enablebanking/client";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
        const { bankConnectionId, accountId } = await request.json();

        if (!bankConnectionId || !accountId) {
            return NextResponse.json(
                { error: "Missing bank connection ID or account ID" },
                { status: 400 },
            );
        }

        const bankConnection = await prisma.bankConnection.findUnique({
            where: { id: bankConnectionId },
        });

        if (!bankConnection) {
            return NextResponse.json(
                { error: "Bank connection not found" },
                { status: 404 },
            );
        }

        const account = await prisma.account.findFirst({
            where: {
                bankConnectionId: bankConnectionId,
                id: accountId,
            },
        });

        if (!account) {
            return NextResponse.json(
                { error: "Account not found" },
                { status: 404 },
            );
        }

        const client = createEnableBankingClient();

        // GET /sessions/{sessionId}/accounts/{accountUid}
        const accountDetails = await client.getAccountDetails(
            bankConnection.itemId,
            account.accountId,
        );

        // Extract balance from response - Enable Banking returns balances array
        const balances = accountDetails.balances || [];
        const availableBalance = balances.find(
            (b: { balance_type?: string }) => b.balance_type === "ITAV",
        );
        const bookedBalance = balances.find(
            (b: { balance_type?: string }) =>
                b.balance_type === "CLBD" || b.balance_type === "ITBD",
        );

        const currentBalance = bookedBalance?.balance_amount?.amount
            ? parseFloat(bookedBalance.balance_amount.amount)
            : availableBalance?.balance_amount?.amount
              ? parseFloat(availableBalance.balance_amount.amount)
              : null;

        const availableBalanceAmount = availableBalance?.balance_amount?.amount
            ? parseFloat(availableBalance.balance_amount.amount)
            : null;

        // Update account with latest balance information
        const updatedAccount = await prisma.account.update({
            where: { id: accountId },
            data: {
                currentBalance: currentBalance,
                availableBalance: availableBalanceAmount,
            },
        });

        return NextResponse.json({
            success: true,
            account: updatedAccount,
            details: accountDetails,
        });
    } catch (error) {
        console.error("Enable Banking account details error:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch account details",
            },
            { status: 500 },
        );
    }
}
