import { NextRequest, NextResponse } from "next/server";
import { createEnableBankingClient } from "@/lib/enablebanking/client";
import { prisma } from "@/lib/db";
import { requireBankOperationMfa } from "@/lib/session";

export async function POST(request: NextRequest) {
    try {
        const mfaCheck = await requireBankOperationMfa();
        if ("error" in mfaCheck) {
            return NextResponse.json(
                { error: mfaCheck.error, code: mfaCheck.code },
                { status: mfaCheck.status },
            );
        }
        const { bankConnectionId } = await request.json();

        if (!bankConnectionId) {
            return NextResponse.json(
                { error: "Missing bank connection ID" },
                { status: 400 },
            );
        }

        const bankConnection = await prisma.bankConnection.findUnique({
            where: { id: bankConnectionId },
            include: { accounts: true },
        });

        if (!bankConnection) {
            return NextResponse.json(
                { error: "Bank connection not found" },
                { status: 404 },
            );
        }

        const client = createEnableBankingClient();

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);

        const dateFrom = startDate.toISOString().split("T")[0];
        const dateTo = endDate.toISOString().split("T")[0];

        // Use session_id to fetch transactions
        const sessionId = bankConnection.itemId;

        for (const account of bankConnection.accounts) {
            let continuationKey: string | undefined;
            let hasMore = true;

            while (hasMore) {
                const transactionsResponse =
                    await client.getTransactionsBySession(
                        sessionId,
                        account.accountId,
                        dateFrom,
                        dateTo,
                        continuationKey,
                    );

                for (const transaction of transactionsResponse.transactions) {
                    const existingTransaction =
                        await prisma.transaction.findUnique({
                            where: {
                                transactionId_accountId: {
                                    transactionId: transaction.entry_reference,
                                    accountId: account.accountId,
                                },
                            },
                        });

                    if (!existingTransaction) {
                        await prisma.transaction.create({
                            data: {
                                bankConnectionId: bankConnection.id,
                                accountId: account.accountId,
                                transactionId: transaction.entry_reference,
                                date: new Date(
                                    transaction.booking_date ||
                                        transaction.value_date ||
                                        new Date(),
                                ),
                                name:
                                    transaction.creditor?.name ||
                                    transaction.debtor?.name ||
                                    transaction.remittance_information?.[0] ||
                                    "Unknown",
                                amount:
                                    transaction.credit_debit_indicator ===
                                    "DBIT"
                                        ? -parseFloat(
                                              transaction.transaction_amount
                                                  .amount,
                                          )
                                        : parseFloat(
                                              transaction.transaction_amount
                                                  .amount,
                                          ),
                                currency:
                                    transaction.transaction_amount.currency,
                                category: transaction.merchant_category_code,
                                pending: transaction.status !== "BOOK",
                                merchantName:
                                    transaction.creditor?.name ||
                                    transaction.debtor?.name,
                            },
                        });
                    }
                }

                continuationKey = transactionsResponse.continuation_key;
                hasMore = !!continuationKey;
            }
        }

        return NextResponse.json({
            success: true,
            transactionsStored: bankConnection.accounts.length,
        });
    } catch (error) {
        console.error("Enable Banking sync transactions error:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to sync transactions",
            },
            { status: 500 },
        );
    }
}
