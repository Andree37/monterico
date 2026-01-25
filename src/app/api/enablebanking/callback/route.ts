import { NextRequest, NextResponse } from "next/server";
import { createEnableBankingClient } from "@/lib/enablebanking/client";
import { prisma } from "@/lib/db";

async function fetchAndSaveTransactions(
    client: ReturnType<typeof createEnableBankingClient>,
    sessionId: string,
    accountUid: string,
    accountId: string,
    bankConnectionId: string,
) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const dateFrom = startDate.toISOString().split("T")[0];
    const dateTo = endDate.toISOString().split("T")[0];

    let totalTransactions = 0;
    let continuationKey: string | undefined;
    let hasMore = true;

    while (hasMore) {
        const transactionsResponse = await client.getTransactionsBySession(
            sessionId,
            accountUid,
            dateFrom,
            dateTo,
            continuationKey,
        );

        for (const transaction of transactionsResponse.transactions) {
            totalTransactions++;

            const existingTransaction = await prisma.transaction.findUnique({
                where: {
                    transactionId_accountId: {
                        transactionId: transaction.entry_reference,
                        accountId: accountId,
                    },
                },
            });

            if (!existingTransaction) {
                await prisma.transaction.create({
                    data: {
                        bankConnectionId: bankConnectionId,
                        accountId: accountId,
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
                            transaction.credit_debit_indicator === "DBIT"
                                ? -parseFloat(
                                      transaction.transaction_amount.amount,
                                  )
                                : parseFloat(
                                      transaction.transaction_amount.amount,
                                  ),
                        currency: transaction.transaction_amount.currency,
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

    return totalTransactions;
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const code = searchParams.get("code");
        const sessionId = searchParams.get("session_id");
        const _state = searchParams.get("state");
        const error = searchParams.get("error");

        if (error) {
            return NextResponse.redirect(
                new URL(`/?error=${encodeURIComponent(error)}`, request.url),
            );
        }

        if (!code || !sessionId) {
            return NextResponse.redirect(
                new URL("/?error=missing_parameters", request.url),
            );
        }

        const client = createEnableBankingClient();

        const sessionResponse = await client.createSession({
            code,
            session_id: sessionId,
        });

        const accounts = sessionResponse.accounts || [];

        if (accounts.length === 0) {
            return NextResponse.redirect(
                new URL("/?error=no_accounts_found", request.url),
            );
        }
        const bankConnection = await prisma.bankConnection.create({
            data: {
                itemId: sessionId,
                accessToken: sessionResponse.access_token || sessionId,
                institutionId: "enablebanking",
                institutionName: "Enable Banking",
                status: "active",
            },
        });

        for (const account of accounts) {
            try {
                if (!account.uid) {
                    continue;
                }

                const dbAccount = await prisma.bankAccount.create({
                    data: {
                        bankConnectionId: bankConnection.id,
                        accountId: account.uid,
                        name: account.name || "Unknown Account",
                        officialName: account.product,
                        type: account.cash_account_type || "CACC",
                        subtype: account.product || "checking",
                        currentBalance: null,
                        availableBalance: null,
                        currency: account.currency,
                    },
                });

                // Fetch account details (including balance) while session is active
                if (account.uid) {
                    try {
                        const accountDetails = await client.getAccountDetails(
                            sessionId,
                            account.uid,
                        );

                        // Parse balance from Enable Banking response
                        const balances = accountDetails.balances || [];
                        const availableBalance = balances.find(
                            (b: { balance_type?: string }) =>
                                b.balance_type === "ITAV",
                        );
                        const bookedBalance = balances.find(
                            (b: { balance_type?: string }) =>
                                b.balance_type === "CLBD" ||
                                b.balance_type === "ITBD",
                        );

                        const currentBalance = bookedBalance?.balance_amount
                            ?.amount
                            ? parseFloat(bookedBalance.balance_amount.amount)
                            : availableBalance?.balance_amount?.amount
                              ? parseFloat(
                                    availableBalance.balance_amount.amount,
                                )
                              : null;

                        const availableBalanceAmount = availableBalance
                            ?.balance_amount?.amount
                            ? parseFloat(availableBalance.balance_amount.amount)
                            : null;

                        // Update account with balance information
                        await prisma.bankAccount.update({
                            where: { id: dbAccount.id },
                            data: {
                                currentBalance: currentBalance,
                                availableBalance: availableBalanceAmount,
                            },
                        });
                    } catch (error) {
                        console.error(
                            "Failed to fetch account details:",
                            error,
                        );
                    }

                    // Fetch transactions immediately while session is active
                    try {
                        await fetchAndSaveTransactions(
                            client,
                            sessionId,
                            account.uid,
                            dbAccount.accountId,
                            bankConnection.id,
                        );
                    } catch (error) {
                        console.error("Failed to fetch transactions:", error);
                    }
                }
            } catch (error) {
                console.error(
                    `Failed to process account ${account.name || account.uid}:`,
                    error,
                );
            }
        }

        return NextResponse.redirect(
            new URL(
                `/?success=true&connection_id=${bankConnection.id}`,
                request.url,
            ),
        );
    } catch (error) {
        console.error("Enable Banking callback error:", error);
        return NextResponse.redirect(
            new URL(
                `/?error=${encodeURIComponent(error instanceof Error ? error.message : "callback_failed")}`,
                request.url,
            ),
        );
    }
}
