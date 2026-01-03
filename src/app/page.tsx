"use client";

import { useEffect, useState } from "react";
import { PlaidLink } from "@/components/PlaidLink";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2, RefreshCw, Trash2, Building2, Wallet } from "lucide-react";

interface Account {
    id: string;
    accountId: string;
    name: string;
    type: string;
    subtype: string | null;
    currentBalance: number | null;
    availableBalance: number | null;
    currency: string | null;
}

interface BankConnection {
    id: string;
    itemId: string;
    institutionName: string | null;
    status: string;
    createdAt: string;
    accounts: Account[];
    _count: {
        transactions: number;
    };
}

interface Transaction {
    id: string;
    transactionId: string;
    date: string;
    name: string;
    amount: number;
    currency: string | null;
    category: string | null;
    pending: boolean;
    account: {
        name: string;
        type: string;
    };
    bankConnection?: {
        institutionName: string | null;
    };
}

export default function Home() {
    const [bankConnections, setBankConnections] = useState<BankConnection[]>(
        [],
    );
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<string | null>(null);

    const fetchBankConnections = async () => {
        try {
            const response = await fetch(
                "/api/bank-connections?userId=default_user",
            );
            const data = await response.json();
            if (data.success) {
                setBankConnections(data.bankConnections);
            }
        } catch (error) {
            console.error("Error fetching bank connections:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTransactions = async () => {
        try {
            const response = await fetch(
                "/api/plaid/transactions?userId=default_user",
            );
            const data = await response.json();
            if (data.success) {
                setTransactions(data.transactions);
            }
        } catch (error) {
            console.error("Error fetching transactions:", error);
        }
    };

    useEffect(() => {
        fetchBankConnections();
        fetchTransactions();
    }, []);

    const syncTransactions = async (bankConnectionId: string) => {
        setSyncing(bankConnectionId);
        try {
            const response = await fetch("/api/plaid/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bankConnectionId }),
            });

            const data = await response.json();

            if (response.status === 202) {
                setTimeout(() => syncTransactions(bankConnectionId), 5000);
                return;
            }

            if (data.success) {
                await fetchTransactions();
                console.log(`Synced ${data.transactionsStored} transactions`);
            }
        } catch (error) {
            console.error("Error syncing transactions:", error);
        } finally {
            setSyncing(null);
        }
    };

    const deleteBankConnection = async (id: string) => {
        if (!confirm("Are you sure you want to delete this bank connection?"))
            return;

        try {
            await fetch(`/api/bank-connections?id=${id}`, { method: "DELETE" });
            await fetchBankConnections();
            await fetchTransactions();
        } catch (error) {
            console.error("Error deleting bank connection:", error);
        }
    };

    const formatCurrency = (amount: number, currency: string = "EUR") => {
        return new Intl.NumberFormat("en-IE", {
            style: "currency",
            currency: currency,
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-IE", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">
                        Monterico
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Track all your bank accounts in one place
                    </p>
                </div>
                <PlaidLink
                    onSuccess={async (bankConnectionId) => {
                        await fetchBankConnections();
                        await syncTransactions(bankConnectionId);
                    }}
                />
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="connections">Connections</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    {bankConnections.length === 0 ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    No Bank Accounts Connected
                                </CardTitle>
                                <CardDescription>
                                    Connect your first bank account to start
                                    tracking transactions
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ) : (
                        <>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {bankConnections.map((connection) =>
                                    connection.accounts.map((account) => (
                                        <Card key={account.id}>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    <Wallet className="h-5 w-5" />
                                                    {account.name}
                                                </CardTitle>
                                                <CardDescription>
                                                    {connection.institutionName ||
                                                        "Bank Account"}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-2">
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Current Balance
                                                        </p>
                                                        <p className="text-2xl font-bold">
                                                            {formatCurrency(
                                                                account.currentBalance ||
                                                                    0,
                                                                account.currency ||
                                                                    "EUR",
                                                            )}
                                                        </p>
                                                    </div>
                                                    {account.availableBalance !==
                                                        null && (
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">
                                                                Available
                                                            </p>
                                                            <p className="text-lg">
                                                                {formatCurrency(
                                                                    account.availableBalance,
                                                                    account.currency ||
                                                                        "EUR",
                                                                )}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-muted-foreground">
                                                        {account.type} •{" "}
                                                        {account.subtype ||
                                                            "Account"}
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )),
                                )}
                            </div>
                        </>
                    )}
                </TabsContent>

                <TabsContent value="transactions" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Transactions</CardTitle>
                            <CardDescription>
                                {transactions.length} transactions found
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {transactions.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">
                                    No transactions yet. Sync your bank accounts
                                    to see transactions.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {transactions.map((transaction) => (
                                        <div
                                            key={transaction.id}
                                            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex-1">
                                                <p className="font-medium">
                                                    {transaction.name}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {transaction.account.name} •{" "}
                                                    {formatDate(
                                                        transaction.date,
                                                    )}
                                                    {transaction.pending && (
                                                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                                            Pending
                                                        </span>
                                                    )}
                                                </p>
                                                {transaction.category && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {transaction.category}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p
                                                    className={`font-semibold ${
                                                        transaction.amount > 0
                                                            ? "text-red-600"
                                                            : "text-green-600"
                                                    }`}
                                                >
                                                    {transaction.amount > 0
                                                        ? "-"
                                                        : "+"}
                                                    {formatCurrency(
                                                        Math.abs(
                                                            transaction.amount,
                                                        ),
                                                        transaction.currency ||
                                                            "EUR",
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="connections" className="space-y-4">
                    {bankConnections.map((connection) => (
                        <Card key={connection.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Building2 className="h-6 w-6" />
                                        <div>
                                            <CardTitle>
                                                {connection.institutionName ||
                                                    "Bank Connection"}
                                            </CardTitle>
                                            <CardDescription>
                                                {connection.accounts.length}{" "}
                                                account(s) -{" "}
                                                {connection._count.transactions}{" "}
                                                transactions
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                syncTransactions(connection.id)
                                            }
                                            disabled={syncing === connection.id}
                                        >
                                            {syncing === connection.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-4 w-4" />
                                            )}
                                            <span className="ml-2">Sync</span>
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() =>
                                                deleteBankConnection(
                                                    connection.id,
                                                )
                                            }
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {connection.accounts.map((account) => (
                                        <div
                                            key={account.id}
                                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {account.name}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {account.type} •{" "}
                                                    {account.subtype ||
                                                        "Account"}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold">
                                                    {formatCurrency(
                                                        account.currentBalance ||
                                                            0,
                                                        account.currency ||
                                                            "EUR",
                                                    )}
                                                </p>
                                                {account.availableBalance !==
                                                    null && (
                                                    <p className="text-sm text-muted-foreground">
                                                        Available:{" "}
                                                        {formatCurrency(
                                                            account.availableBalance,
                                                            account.currency ||
                                                                "EUR",
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Separator className="my-4" />
                                <div className="text-xs text-muted-foreground">
                                    <p>Item ID: {connection.itemId}</p>
                                    <p>
                                        Connected:{" "}
                                        {formatDate(connection.createdAt)}
                                    </p>
                                    <p>Status: {connection.status}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {bankConnections.length === 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>No Bank Connections</CardTitle>
                                <CardDescription>
                                    Connect your first bank account to get
                                    started
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
