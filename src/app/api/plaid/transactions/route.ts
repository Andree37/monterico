import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
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

        const accessToken = bankConnection.accessToken;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const endDate = new Date();

        const response = await plaidClient.transactionsGet({
            access_token: accessToken,
            start_date: startDate.toISOString().split("T")[0],
            end_date: endDate.toISOString().split("T")[0],
        });

        const storedTransactions = await Promise.all(
            response.data.transactions.map(async (tx) => {
                return await prisma.transaction.upsert({
                    where: { transactionId: tx.transaction_id },
                    update: {
                        date: new Date(tx.date),
                        name: tx.name,
                        amount: -tx.amount,
                        currency: tx.iso_currency_code || null,
                        category: tx.category ? tx.category.join(", ") : null,
                        pending: tx.pending,
                        merchantName: tx.merchant_name || null,
                    },
                    create: {
                        bankConnectionId: bankConnection.id,
                        accountId: tx.account_id,
                        transactionId: tx.transaction_id,
                        date: new Date(tx.date),
                        name: tx.name,
                        amount: -tx.amount,
                        currency: tx.iso_currency_code || null,
                        category: tx.category ? tx.category.join(", ") : null,
                        pending: tx.pending,
                        merchantName: tx.merchant_name || null,
                    },
                });
            }),
        );

        await Promise.all(
            response.data.accounts.map(async (acc) => {
                await prisma.account.update({
                    where: { accountId: acc.account_id },
                    data: {
                        currentBalance: acc.balances.current,
                        availableBalance: acc.balances.available,
                    },
                });
            }),
        );

        return NextResponse.json({
            success: true,
            transactionsStored: storedTransactions.length,
        });
    } catch (error: unknown) {
        console.error("Error fetching/storing transactions:", error);

        const errorResponse = (
            error as { response?: { data?: { error_code?: string } } }
        ).response;
        if (errorResponse?.data?.error_code === "PRODUCT_NOT_READY") {
            return NextResponse.json(
                {
                    error: "PRODUCT_NOT_READY",
                    message:
                        "Transactions are still being processed. Please try again in a few seconds.",
                    retry_after: 10,
                },
                { status: 202 },
            );
        }

        const message =
            error instanceof Error ? error.message : "An error occurred";
        const responseData = errorResponse?.data;
        return NextResponse.json(
            { error: responseData || message },
            { status: 500 },
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const bankConnectionId = searchParams.get("bankConnectionId");

        let transactions;

        if (bankConnectionId) {
            transactions = await prisma.transaction.findMany({
                where: { bankConnectionId },
                include: {
                    account: {
                        select: {
                            name: true,
                            type: true,
                        },
                    },
                    bankConnection: {
                        select: {
                            institutionName: true,
                        },
                    },
                },
                orderBy: { date: "desc" },
            });
        } else {
            transactions = await prisma.transaction.findMany({
                include: {
                    account: {
                        select: {
                            name: true,
                            type: true,
                        },
                    },
                    bankConnection: {
                        select: {
                            institutionName: true,
                        },
                    },
                },
                orderBy: { date: "desc" },
            });
        }

        return NextResponse.json({
            success: true,
            transactions,
            count: transactions.length,
        });
    } catch (error: unknown) {
        console.error("Error fetching transactions:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            transactionId,
            linkedToIncome,
            incomeId,
            linkedToExpense,
            expenseId,
        } = body;

        if (!transactionId) {
            return NextResponse.json(
                { error: "Missing transaction ID" },
                { status: 400 },
            );
        }

        const updateData: {
            linkedToIncome?: boolean;
            incomeId?: string | null;
            linkedToExpense?: boolean;
            expenseId?: string | null;
        } = {};

        if (linkedToIncome !== undefined) {
            updateData.linkedToIncome = linkedToIncome;
        }
        if (incomeId !== undefined) {
            updateData.incomeId = incomeId;
        }
        if (linkedToExpense !== undefined) {
            updateData.linkedToExpense = linkedToExpense;
        }
        if (expenseId !== undefined) {
            updateData.expenseId = expenseId;
        }

        const transaction = await prisma.transaction.updateMany({
            where: { transactionId },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            transaction,
        });
    } catch (error: unknown) {
        console.error("Error updating transaction:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
