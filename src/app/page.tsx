"use client";

import { useEffect, useState } from "react";
import { PlaidLink } from "@/components/PlaidLink";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
    Loader2,
    RefreshCw,
    Trash2,
    Building2,
    Wallet,
    Check,
    Settings as SettingsIcon,
    X,
} from "lucide-react";

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
    account: {
        name: string;
        type: string;
    };
    bankConnection?: {
        institutionName: string | null;
    };
}

interface Settings {
    id: string;
    defaultAndreRatio: number;
    defaultRitaRatio: number;
    defaultPaidBy: string;
    defaultType: string;
}

export default function Home() {
    const [bankConnections, setBankConnections] = useState<BankConnection[]>(
        [],
    );
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [syncingAll, setSyncingAll] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [editingSettings, setEditingSettings] = useState({
        defaultAndreRatio: 0.5,
        defaultRitaRatio: 0.5,
        defaultPaidBy: "andre",
        defaultType: "shared",
    });
    const [expandedTransaction, setExpandedTransaction] = useState<
        string | null
    >(null);
    const [quickImport, setQuickImport] = useState<{
        [key: string]: {
            categoryId: string;
            paidBy: string;
            type: "shared" | "personal";
        };
    }>({});

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

    const fetchCategories = async () => {
        try {
            const response = await fetch("/api/categories");
            const data = await response.json();
            if (data.success) {
                setCategories(data.categories);
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
        }
    };

    const fetchSettings = async () => {
        try {
            const response = await fetch("/api/settings");
            const data = await response.json();
            if (data.success && data.settings) {
                setSettings(data.settings);
                setEditingSettings({
                    defaultAndreRatio: data.settings.defaultAndreRatio,
                    defaultRitaRatio: data.settings.defaultRitaRatio,
                    defaultPaidBy: data.settings.defaultPaidBy,
                    defaultType: data.settings.defaultType,
                });
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        }
    };

    useEffect(() => {
        fetchBankConnections();
        fetchTransactions();
        fetchCategories();
        fetchSettings();
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

    const syncAllTransactions = async () => {
        if (bankConnections.length === 0) return;

        setSyncingAll(true);
        try {
            for (const connection of bankConnections) {
                await syncTransactions(connection.id);
            }
        } catch (error) {
            console.error("Error syncing all transactions:", error);
        } finally {
            setSyncingAll(false);
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

    const saveSettings = async () => {
        try {
            const response = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingSettings),
            });

            const data = await response.json();
            if (data.success) {
                setSettings(data.settings);
                setShowSettings(false);
                alert("Settings saved successfully!");
            } else {
                alert(
                    `Failed to save settings: ${data.error || "Unknown error"}`,
                );
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            alert(
                `Error saving settings: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    };

    const toggleTransactionExpand = (transactionId: string) => {
        if (expandedTransaction === transactionId) {
            setExpandedTransaction(null);
        } else {
            setExpandedTransaction(transactionId);
            // Initialize quick import data with defaults
            if (!quickImport[transactionId]) {
                setQuickImport({
                    ...quickImport,
                    [transactionId]: {
                        categoryId: "",
                        paidBy: settings?.defaultPaidBy || "andre",
                        type: (settings?.defaultType || "shared") as
                            | "shared"
                            | "personal",
                    },
                });
            }
        }
    };

    const updateQuickImport = (
        transactionId: string,
        field: string,
        value: any,
    ) => {
        setQuickImport({
            ...quickImport,
            [transactionId]: {
                ...quickImport[transactionId],
                [field]: value,
            },
        });
    };

    const importTransactionInline = async (transaction: Transaction) => {
        const importData = quickImport[transaction.transactionId];
        if (!importData || !importData.categoryId) {
            alert("Please select a category");
            return;
        }

        const amount = Math.abs(transaction.amount);
        let splits;

        if (importData.type === "personal") {
            if (importData.paidBy === "andre") {
                splits = [
                    { userId: "andre", amount: amount, paid: true },
                    { userId: "rita", amount: 0, paid: true },
                ];
            } else {
                splits = [
                    { userId: "andre", amount: 0, paid: true },
                    { userId: "rita", amount: amount, paid: true },
                ];
            }
        } else {
            const andreRatio = settings?.defaultAndreRatio || 0.5;
            const ritaRatio = settings?.defaultRitaRatio || 0.5;
            splits = [
                {
                    userId: "andre",
                    amount: amount * andreRatio,
                    paid: true,
                },
                {
                    userId: "rita",
                    amount: amount * ritaRatio,
                    paid: true,
                },
            ];
        }

        try {
            const response = await fetch("/api/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: transaction.date,
                    description: transaction.name,
                    categoryId: importData.categoryId,
                    amount: amount,
                    currency: transaction.currency || "EUR",
                    paidById: importData.paidBy,
                    type: importData.type,
                    paid: true,
                    splits: splits,
                    transactionId: transaction.transactionId,
                }),
            });

            if (response.ok) {
                await fetchTransactions();
                setExpandedTransaction(null);
                // Remove from quickImport
                const newQuickImport = { ...quickImport };
                delete newQuickImport[transaction.transactionId];
                setQuickImport(newQuickImport);
            }
        } catch (error) {
            console.error("Error importing transaction:", error);
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
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight">
                            Monterico
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Track all your bank accounts in one place
                        </p>
                    </div>
                    <Link href="/expenses">
                        <Button variant="outline">Expenses</Button>
                    </Link>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowSettings(!showSettings)}
                    >
                        <SettingsIcon className="h-4 w-4" />
                    </Button>
                    <PlaidLink
                        onSuccess={async (bankConnectionId) => {
                            await fetchBankConnections();
                            await syncTransactions(bankConnectionId);
                        }}
                    />
                </div>
            </div>

            {showSettings && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Default Import Settings</CardTitle>
                        <CardDescription>
                            Set default values for quick transaction import
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium block mb-2">
                                    Default Split Ratio
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-muted-foreground">
                                            Andre (%)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={Math.round(
                                                editingSettings.defaultAndreRatio *
                                                    100,
                                            )}
                                            onChange={(e) => {
                                                const ratio =
                                                    parseInt(e.target.value) /
                                                    100;
                                                setEditingSettings({
                                                    ...editingSettings,
                                                    defaultAndreRatio: ratio,
                                                    defaultRitaRatio: 1 - ratio,
                                                });
                                            }}
                                            className="w-full p-2 border rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">
                                            Rita (%)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={Math.round(
                                                editingSettings.defaultRitaRatio *
                                                    100,
                                            )}
                                            onChange={(e) => {
                                                const ratio =
                                                    parseInt(e.target.value) /
                                                    100;
                                                setEditingSettings({
                                                    ...editingSettings,
                                                    defaultAndreRatio:
                                                        1 - ratio,
                                                    defaultRitaRatio: ratio,
                                                });
                                            }}
                                            className="w-full p-2 border rounded"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-2">
                                    Default Paid By
                                </label>
                                <select
                                    value={editingSettings.defaultPaidBy}
                                    onChange={(e) =>
                                        setEditingSettings({
                                            ...editingSettings,
                                            defaultPaidBy: e.target.value,
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="andre">Andre Ribeiro</option>
                                    <option value="rita">Rita Pereira</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-2">
                                    Default Type
                                </label>
                                <select
                                    value={editingSettings.defaultType}
                                    onChange={(e) =>
                                        setEditingSettings({
                                            ...editingSettings,
                                            defaultType: e.target.value,
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="shared">Shared</option>
                                    <option value="personal">Personal</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button onClick={saveSettings}>
                                Save Settings
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowSettings(false)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

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
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Recent Transactions</CardTitle>
                                    <CardDescription>
                                        {transactions.length} transactions found
                                        •{" "}
                                        {
                                            transactions.filter(
                                                (t) => t.linkedToExpense,
                                            ).length
                                        }{" "}
                                        tracked
                                    </CardDescription>
                                </div>
                                <Button
                                    onClick={syncAllTransactions}
                                    disabled={
                                        syncingAll ||
                                        bankConnections.length === 0
                                    }
                                    variant="outline"
                                >
                                    {syncingAll ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Syncing...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Refresh All
                                        </>
                                    )}
                                </Button>
                            </div>
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
                                            className={`border rounded-lg overflow-hidden ${
                                                transaction.linkedToExpense
                                                    ? "bg-green-50 border-green-200"
                                                    : ""
                                            }`}
                                        >
                                            <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                                                <div className="flex items-center gap-3 flex-1">
                                                    {transaction.linkedToExpense ? (
                                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white">
                                                            <Check className="h-4 w-4" />
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() =>
                                                                toggleTransactionExpand(
                                                                    transaction.transactionId,
                                                                )
                                                            }
                                                            className="flex items-center justify-center w-6 h-6 rounded border-2 border-gray-300 hover:border-blue-500 transition-colors"
                                                        >
                                                            {expandedTransaction ===
                                                                transaction.transactionId && (
                                                                <X className="h-3 w-3" />
                                                            )}
                                                        </button>
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="font-medium">
                                                            {transaction.name}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {transaction
                                                                .bankConnection
                                                                ?.institutionName && (
                                                                <>
                                                                    {
                                                                        transaction
                                                                            .bankConnection
                                                                            .institutionName
                                                                    }{" "}
                                                                    -{" "}
                                                                </>
                                                            )}
                                                            {
                                                                transaction
                                                                    .account
                                                                    .name
                                                            }{" "}
                                                            •{" "}
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
                                                                {
                                                                    transaction.category
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p
                                                        className={`font-semibold ${
                                                            transaction.amount >
                                                            0
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
                                                    {transaction.linkedToExpense && (
                                                        <p className="text-xs text-green-600 font-medium">
                                                            Tracked
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {expandedTransaction ===
                                                transaction.transactionId &&
                                                !transaction.linkedToExpense && (
                                                    <div className="px-3 pb-3 pt-2 bg-muted/30 border-t">
                                                        <p className="text-xs font-medium mb-2 text-muted-foreground">
                                                            Quick Import to
                                                            Expenses
                                                        </p>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <select
                                                                value={
                                                                    quickImport[
                                                                        transaction
                                                                            .transactionId
                                                                    ]
                                                                        ?.categoryId ||
                                                                    ""
                                                                }
                                                                onChange={(e) =>
                                                                    updateQuickImport(
                                                                        transaction.transactionId,
                                                                        "categoryId",
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                className="p-2 border rounded text-sm"
                                                            >
                                                                <option value="">
                                                                    Category...
                                                                </option>
                                                                {categories.map(
                                                                    (cat) => (
                                                                        <option
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
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </select>
                                                            <select
                                                                value={
                                                                    quickImport[
                                                                        transaction
                                                                            .transactionId
                                                                    ]?.paidBy ||
                                                                    settings?.defaultPaidBy ||
                                                                    "andre"
                                                                }
                                                                onChange={(e) =>
                                                                    updateQuickImport(
                                                                        transaction.transactionId,
                                                                        "paidBy",
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                className="p-2 border rounded text-sm"
                                                            >
                                                                <option value="andre">
                                                                    Andre
                                                                </option>
                                                                <option value="rita">
                                                                    Rita
                                                                </option>
                                                            </select>
                                                            <select
                                                                value={
                                                                    quickImport[
                                                                        transaction
                                                                            .transactionId
                                                                    ]?.type ||
                                                                    settings?.defaultType ||
                                                                    "shared"
                                                                }
                                                                onChange={(e) =>
                                                                    updateQuickImport(
                                                                        transaction.transactionId,
                                                                        "type",
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                className="p-2 border rounded text-sm"
                                                            >
                                                                <option value="shared">
                                                                    Shared
                                                                </option>
                                                                <option value="personal">
                                                                    Personal
                                                                </option>
                                                            </select>
                                                        </div>
                                                        <div className="flex gap-2 mt-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={() =>
                                                                    importTransactionInline(
                                                                        transaction,
                                                                    )
                                                                }
                                                                disabled={
                                                                    !quickImport[
                                                                        transaction
                                                                            .transactionId
                                                                    ]
                                                                        ?.categoryId
                                                                }
                                                                className="flex-1"
                                                            >
                                                                <Check className="mr-1 h-3 w-3" />
                                                                Track
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    setExpandedTransaction(
                                                                        null,
                                                                    )
                                                                }
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                        {quickImport[
                                                            transaction
                                                                .transactionId
                                                        ]?.type ===
                                                            "shared" && (
                                                            <p className="text-xs text-muted-foreground mt-2">
                                                                Split:{" "}
                                                                {Math.round(
                                                                    (settings?.defaultAndreRatio ||
                                                                        0.5) *
                                                                        100,
                                                                )}
                                                                % Andre,{" "}
                                                                {Math.round(
                                                                    (settings?.defaultRitaRatio ||
                                                                        0.5) *
                                                                        100,
                                                                )}
                                                                % Rita
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
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
