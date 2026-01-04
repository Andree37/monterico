"use client";

import { useEffect, useState, useCallback } from "react";
import { PlaidLink } from "@/components/PlaidLink";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Loader2,
    RefreshCw,
    Trash2,
    Building2,
    Check,
    X,
    Settings as SettingsIcon,
} from "lucide-react";
import { useAccountingMode } from "@/hooks/use-accounting-mode";

interface Category {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
}

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
    userId: string | null;
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
    linkedToExpense: boolean;
    expenseId: string | null;
    linkedToIncome: boolean;
    incomeId: string | null;
    account: {
        name: string;
        type: string;
    };
    bankConnection?: {
        institutionName: string | null;
    };
}

interface User {
    id: string;
    name: string;
    email: string | null;
    isActive: boolean;
}

interface ImportData {
    transactionId: string;
    categoryId?: string;
    paidById?: string;
    isPersonal?: boolean;
    paidFromPool?: boolean;
}

export default function Home() {
    const { accountingMode, settings } = useAccountingMode();
    const [bankConnections, setBankConnections] = useState<BankConnection[]>(
        [],
    );
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [selectedFilter, setSelectedFilter] = useState<string>("all");
    const [importData, setImportData] = useState<{ [key: string]: ImportData }>(
        {},
    );

    const loadBankConnections = async () => {
        try {
            const response = await fetch("/api/bank-connections");
            if (response.ok) {
                const data = await response.json();
                setBankConnections(data.bankConnections || []);
            }
        } catch (error) {
            console.error("Error loading bank connections:", error);
        }
    };

    const loadTransactions = async () => {
        try {
            const response = await fetch("/api/plaid/transactions");
            if (response.ok) {
                const data = await response.json();
                setTransactions(data.transactions || []);
            }
        } catch (error) {
            console.error("Error loading transactions:", error);
        }
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([loadBankConnections(), loadTransactions()]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            await loadData();
            await loadCategories();
            await loadUsers();
        };
        init();
    }, [loadData]);

    const loadCategories = async () => {
        try {
            const response = await fetch("/api/categories");
            if (response.ok) {
                const data = await response.json();
                setCategories(data.categories || []);
            }
        } catch (error) {
            console.error("Error loading categories:", error);
        }
    };

    const loadUsers = async () => {
        try {
            const response = await fetch("/api/users");
            if (response.ok) {
                const data = await response.json();
                setUsers(data || []);
            }
        } catch (error) {
            console.error("Error loading users:", error);
        }
    };

    const handlePlaidSuccess = async () => {
        toast({
            title: "Success",
            description: "Bank account connected successfully",
        });
        await loadData();
    };

    const syncTransactions = async (connectionId: string) => {
        setSyncing(connectionId);
        try {
            const response = await fetch("/api/plaid/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bankConnectionId: connectionId }),
            });

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "Transactions synced successfully",
                });
                await loadTransactions();
            } else {
                throw new Error("Failed to sync transactions");
            }
        } catch {
            toast({
                title: "Error",
                description: "Failed to sync transactions",
                type: "error",
            });
        } finally {
            setSyncing(null);
        }
    };

    const deleteConnection = async (connectionId: string) => {
        if (!confirm("Are you sure you want to delete this connection?"))
            return;

        try {
            const response = await fetch(
                `/api/bank-connections?id=${connectionId}`,
                {
                    method: "DELETE",
                },
            );

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "Bank connection deleted",
                });
                await loadData();
            }
        } catch {
            toast({
                title: "Error",
                description: "Failed to delete connection",
                type: "error",
            });
        }
    };

    const updateConnectionOwner = async (
        connectionId: string,
        userId: string,
    ) => {
        try {
            const response = await fetch("/api/bank-connections", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: connectionId, userId }),
            });

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "Owner updated",
                });
                await loadBankConnections();
            }
        } catch {
            toast({
                title: "Error",
                description: "Failed to update owner",
                type: "error",
            });
        }
    };

    const handleImportDataChange = (
        transactionId: string,
        field: keyof ImportData,
        value: string | boolean,
    ) => {
        setImportData((prev) => ({
            ...prev,
            [transactionId]: {
                ...prev[transactionId],
                transactionId,
                [field]: value,
            },
        }));
    };

    const importTransaction = async (transaction: Transaction) => {
        const data = importData[transaction.transactionId];
        if (!data) return;

        try {
            const isExpense = transaction.amount < 0;

            if (isExpense) {
                const endpoint =
                    accountingMode === "shared_pool"
                        ? "/api/expenses/shared-pool"
                        : "/api/expenses/individual";

                const requestBody: Record<string, unknown> = {
                    date: transaction.date,
                    description: transaction.name,
                    categoryId: data.categoryId,
                    amount: Math.abs(transaction.amount),
                    currency: transaction.currency || "EUR",
                    paidById: data.paidById,
                    type: data.isPersonal ? "personal" : "shared",
                    transactionId: transaction.transactionId,
                };

                if (accountingMode === "shared_pool" && !data.isPersonal) {
                    requestBody.paidFromPool = data.paidFromPool ?? true;
                } else if (
                    accountingMode === "individual" &&
                    !data.isPersonal
                ) {
                    requestBody.splitType =
                        settings?.defaultSplitType || "equal";
                }

                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                });

                if (response.ok) {
                    toast({
                        title: "Success",
                        description: "Transaction imported as expense",
                    });
                    await loadTransactions();
                }
            } else {
                const endpoint =
                    accountingMode === "shared_pool"
                        ? "/api/income/shared-pool"
                        : "/api/income";

                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        date: transaction.date,
                        description: transaction.name,
                        amount: transaction.amount,
                        currency: transaction.currency || "EUR",
                        userId: data.paidById,
                        transactionId: transaction.transactionId,
                    }),
                });

                if (response.ok) {
                    toast({
                        title: "Success",
                        description: "Transaction imported as income",
                    });
                    await loadTransactions();
                }
            }
        } catch {
            toast({
                title: "Error",
                description: "Failed to import transaction",
                type: "error",
            });
        }
    };

    const unlinkTransaction = async (transactionId: string) => {
        try {
            const transaction = transactions.find(
                (t) => t.transactionId === transactionId,
            );

            if (!transaction) return;

            if (transaction.expenseId) {
                const deleteExpenseResponse = await fetch(
                    `/api/expenses?id=${transaction.expenseId}`,
                    {
                        method: "DELETE",
                    },
                );

                if (!deleteExpenseResponse.ok) {
                    toast({
                        title: "Error",
                        description: "Failed to delete associated expense",
                        type: "error",
                    });
                    return;
                }
            }

            if (transaction.incomeId) {
                const deleteIncomeResponse = await fetch(
                    `/api/income?id=${transaction.incomeId}`,
                    {
                        method: "DELETE",
                    },
                );

                if (!deleteIncomeResponse.ok) {
                    toast({
                        title: "Error",
                        description: "Failed to delete associated income",
                        type: "error",
                    });
                    return;
                }
            }

            const response = await fetch("/api/plaid/transactions", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    transactionId,
                    linkedToExpense: false,
                    expenseId: null,
                    linkedToIncome: false,
                    incomeId: null,
                }),
            });

            if (response.ok) {
                toast({
                    title: "Success",
                    description:
                        "Transaction unlinked and expense/income deleted",
                });
                await loadTransactions();
            }
        } catch {
            toast({
                title: "Error",
                description: "Failed to unlink transaction",
                type: "error",
            });
        }
    };

    const filteredTransactions = transactions.filter((t) => {
        if (selectedFilter === "all") return true;
        if (selectedFilter === "unlinked")
            return !t.linkedToExpense && !t.linkedToIncome;
        if (selectedFilter === "linked")
            return t.linkedToExpense || t.linkedToIncome;
        return true;
    });

    const activeUsers = users.filter((u) => u.isActive);

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">
                        Bank Transactions
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Connect your bank accounts and import transactions
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/settings">
                        <Button variant="outline">
                            <SettingsIcon className="mr-2 h-4 w-4" />
                            Settings
                        </Button>
                    </Link>
                    <Link href="/income/shared-pool">
                        <Button variant="outline">Income</Button>
                    </Link>
                    <Link href="/expenses">
                        <Button variant="outline">Expenses</Button>
                    </Link>
                </div>
            </div>

            <Tabs defaultValue="connections" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="connections">
                        Bank Connections
                    </TabsTrigger>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                </TabsList>

                <TabsContent value="connections" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Connect Your Bank</CardTitle>
                            <CardDescription>
                                Link your bank accounts to automatically import
                                transactions
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <PlaidLink onSuccess={handlePlaidSuccess} />
                        </CardContent>
                    </Card>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {bankConnections.map((connection) => (
                                <Card key={connection.id}>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Building2 className="h-5 w-5" />
                                                <div>
                                                    <CardTitle className="text-lg">
                                                        {connection.institutionName ||
                                                            "Bank"}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        {
                                                            connection.accounts
                                                                .length
                                                        }{" "}
                                                        account(s) •{" "}
                                                        {
                                                            connection._count
                                                                .transactions
                                                        }{" "}
                                                        transactions
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    onClick={() =>
                                                        syncTransactions(
                                                            connection.id,
                                                        )
                                                    }
                                                    disabled={
                                                        syncing ===
                                                        connection.id
                                                    }
                                                >
                                                    {syncing ===
                                                    connection.id ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                            Syncing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <RefreshCw className="h-4 w-4 mr-2" />
                                                            Sync Transactions
                                                        </>
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        deleteConnection(
                                                            connection.id,
                                                        )
                                                    }
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <Label className="text-sm">
                                                Account Owner
                                            </Label>
                                            <Select
                                                value={connection.userId || ""}
                                                onValueChange={(value) =>
                                                    updateConnectionOwner(
                                                        connection.id,
                                                        value,
                                                    )
                                                }
                                            >
                                                <SelectTrigger className="w-48 mt-1">
                                                    <SelectValue placeholder="Unassigned - Select owner" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {activeUsers.map((user) => (
                                                        <SelectItem
                                                            key={user.id}
                                                            value={user.id}
                                                        >
                                                            {user.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {connection.accounts.map(
                                                (account) => (
                                                    <div
                                                        key={account.id}
                                                        className="flex items-center justify-between p-3 bg-muted/50 rounded"
                                                    >
                                                        <div>
                                                            <p className="font-medium">
                                                                {account.name}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {account.type} •{" "}
                                                                {
                                                                    account.subtype
                                                                }
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-semibold">
                                                                €
                                                                {account.currentBalance?.toFixed(
                                                                    2,
                                                                ) || "0.00"}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">
                                                                Available: €
                                                                {account.availableBalance?.toFixed(
                                                                    2,
                                                                ) || "0.00"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="transactions" className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Label>Filter:</Label>
                        <Select
                            value={selectedFilter}
                            onValueChange={setSelectedFilter}
                        >
                            <SelectTrigger className="w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All Transactions
                                </SelectItem>
                                <SelectItem value="unlinked">
                                    Unlinked Only
                                </SelectItem>
                                <SelectItem value="linked">
                                    Linked Only
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator />

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredTransactions.map((transaction) => (
                                <Card
                                    key={transaction.id}
                                    className={
                                        transaction.linkedToExpense ||
                                        transaction.linkedToIncome
                                            ? "opacity-50"
                                            : ""
                                    }
                                >
                                    <CardContent className="py-2 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 min-w-0 flex items-center gap-3">
                                                <p
                                                    className={`text-sm font-semibold w-24 text-right shrink-0 ${
                                                        transaction.amount > 0
                                                            ? "text-green-600"
                                                            : "text-red-600"
                                                    }`}
                                                >
                                                    {transaction.amount > 0
                                                        ? "+"
                                                        : ""}
                                                    €
                                                    {Math.abs(
                                                        transaction.amount,
                                                    ).toFixed(2)}
                                                </p>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-medium truncate">
                                                            {transaction.name}
                                                        </p>
                                                        {transaction.pending && (
                                                            <span className="text-xs bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded shrink-0">
                                                                Pending
                                                            </span>
                                                        )}
                                                        {transaction.linkedToExpense && (
                                                            <span className="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded flex items-center gap-1 shrink-0">
                                                                <Check className="h-3 w-3" />
                                                                Expense
                                                            </span>
                                                        )}
                                                        {transaction.linkedToIncome && (
                                                            <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded flex items-center gap-1 shrink-0">
                                                                <Check className="h-3 w-3" />
                                                                Income
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(
                                                            transaction.date,
                                                        ).toLocaleDateString(
                                                            "en-GB",
                                                        )}{" "}
                                                        •{" "}
                                                        {
                                                            transaction.account
                                                                .name
                                                        }
                                                    </p>
                                                </div>
                                            </div>

                                            {transaction.linkedToExpense ||
                                            transaction.linkedToIncome ? (
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            unlinkTransaction(
                                                                transaction.transactionId,
                                                            )
                                                        }
                                                    >
                                                        <X className="h-3 w-3 mr-1" />
                                                        Unlink
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {transaction.amount < 0 ? (
                                                        <>
                                                            <Select
                                                                value={
                                                                    importData[
                                                                        transaction
                                                                            .transactionId
                                                                    ]
                                                                        ?.isPersonal
                                                                        ? "personal"
                                                                        : "shared"
                                                                }
                                                                onValueChange={(
                                                                    value,
                                                                ) =>
                                                                    handleImportDataChange(
                                                                        transaction.transactionId,
                                                                        "isPersonal",
                                                                        value ===
                                                                            "personal",
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger className="w-28">
                                                                    <SelectValue placeholder="Type" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="shared">
                                                                        Shared
                                                                    </SelectItem>
                                                                    <SelectItem value="personal">
                                                                        Personal
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>

                                                            {accountingMode ===
                                                                "shared_pool" &&
                                                                !importData[
                                                                    transaction
                                                                        .transactionId
                                                                ]
                                                                    ?.isPersonal && (
                                                                    <Select
                                                                        value={
                                                                            (importData[
                                                                                transaction
                                                                                    .transactionId
                                                                            ]
                                                                                ?.paidFromPool ??
                                                                            true)
                                                                                ? "pool"
                                                                                : "pending"
                                                                        }
                                                                        onValueChange={(
                                                                            value,
                                                                        ) =>
                                                                            handleImportDataChange(
                                                                                transaction.transactionId,
                                                                                "paidFromPool",
                                                                                value ===
                                                                                    "pool",
                                                                            )
                                                                        }
                                                                    >
                                                                        <SelectTrigger className="w-32">
                                                                            <SelectValue placeholder="From Pool" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="pool">
                                                                                From
                                                                                Pool
                                                                            </SelectItem>
                                                                            <SelectItem value="pending">
                                                                                Pending
                                                                            </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                )}

                                                            <Select
                                                                value={
                                                                    importData[
                                                                        transaction
                                                                            .transactionId
                                                                    ]
                                                                        ?.categoryId ||
                                                                    ""
                                                                }
                                                                onValueChange={(
                                                                    value,
                                                                ) =>
                                                                    handleImportDataChange(
                                                                        transaction.transactionId,
                                                                        "categoryId",
                                                                        value,
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger className="w-40">
                                                                    <SelectValue placeholder="Category" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {categories.map(
                                                                        (
                                                                            cat,
                                                                        ) => (
                                                                            <SelectItem
                                                                                key={
                                                                                    cat.id
                                                                                }
                                                                                value={
                                                                                    cat.id
                                                                                }
                                                                            >
                                                                                {
                                                                                    cat.icon
                                                                                }{" "}
                                                                                {
                                                                                    cat.name
                                                                                }
                                                                            </SelectItem>
                                                                        ),
                                                                    )}
                                                                </SelectContent>
                                                            </Select>

                                                            <Select
                                                                value={
                                                                    importData[
                                                                        transaction
                                                                            .transactionId
                                                                    ]
                                                                        ?.paidById ||
                                                                    ""
                                                                }
                                                                onValueChange={(
                                                                    value,
                                                                ) =>
                                                                    handleImportDataChange(
                                                                        transaction.transactionId,
                                                                        "paidById",
                                                                        value,
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger className="w-32">
                                                                    <SelectValue placeholder="User" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {activeUsers.map(
                                                                        (
                                                                            user,
                                                                        ) => (
                                                                            <SelectItem
                                                                                key={
                                                                                    user.id
                                                                                }
                                                                                value={
                                                                                    user.id
                                                                                }
                                                                            >
                                                                                {
                                                                                    user.name
                                                                                }
                                                                            </SelectItem>
                                                                        ),
                                                                    )}
                                                                </SelectContent>
                                                            </Select>

                                                            <Button
                                                                size="sm"
                                                                className="w-20"
                                                                onClick={() =>
                                                                    importTransaction(
                                                                        transaction,
                                                                    )
                                                                }
                                                                disabled={
                                                                    !importData[
                                                                        transaction
                                                                            .transactionId
                                                                    ]
                                                                        ?.categoryId ||
                                                                    !importData[
                                                                        transaction
                                                                            .transactionId
                                                                    ]?.paidById
                                                                }
                                                            >
                                                                Import
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Select
                                                                value={
                                                                    importData[
                                                                        transaction
                                                                            .transactionId
                                                                    ]
                                                                        ?.paidById ||
                                                                    ""
                                                                }
                                                                onValueChange={(
                                                                    value,
                                                                ) =>
                                                                    handleImportDataChange(
                                                                        transaction.transactionId,
                                                                        "paidById",
                                                                        value,
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger className="w-40">
                                                                    <SelectValue placeholder="Received by" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {activeUsers.map(
                                                                        (
                                                                            user,
                                                                        ) => (
                                                                            <SelectItem
                                                                                key={
                                                                                    user.id
                                                                                }
                                                                                value={
                                                                                    user.id
                                                                                }
                                                                            >
                                                                                {
                                                                                    user.name
                                                                                }
                                                                            </SelectItem>
                                                                        ),
                                                                    )}
                                                                </SelectContent>
                                                            </Select>

                                                            <Button
                                                                size="sm"
                                                                className="w-20"
                                                                onClick={() =>
                                                                    importTransaction(
                                                                        transaction,
                                                                    )
                                                                }
                                                                disabled={
                                                                    !importData[
                                                                        transaction
                                                                            .transactionId
                                                                    ]?.paidById
                                                                }
                                                            >
                                                                Import
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {filteredTransactions.length === 0 && (
                                <div className="text-center py-12 text-muted-foreground">
                                    No transactions found
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
