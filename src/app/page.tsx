"use client";

import { useEffect, useState } from "react";
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

interface Settings {
    id: string;
    defaultPaidBy: string | null;
    defaultType: string;
    defaultSplitType: string;
}

interface User {
    id: string;
    name: string;
    email: string | null;
    ratio: number;
    isActive: boolean;
}

export default function Home() {
    const [bankConnections, setBankConnections] = useState<BankConnection[]>(
        [],
    );
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [syncingAll, setSyncingAll] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [editingSettings, setEditingSettings] = useState({
        defaultPaidBy: "none",
        defaultType: "shared",
        defaultSplitType: "equal",
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
    const [quickIncomeImport, setQuickIncomeImport] = useState<{
        [key: string]: {
            incomeType: string;
            userId: string;
        };
    }>({});

    const incomeTypes = ["Salario", "Beneficios", "Extras"];

    const fetchUsers = async () => {
        try {
            const response = await fetch("/api/users");
            const data = await response.json();
            setUsers(data.filter((u: User) => u.isActive));
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

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
                    defaultPaidBy: data.settings.defaultPaidBy || "none",
                    defaultType: data.settings.defaultType,
                    defaultSplitType: data.settings.defaultSplitType || "equal",
                });
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        }
    };

    useEffect(() => {
        fetchUsers();
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
        try {
            const response = await fetch(`/api/bank-connections?id=${id}`, {
                method: "DELETE",
            });

            if (response.ok) {
                await fetchBankConnections();
                await fetchTransactions();
                toast({
                    title: "Success",
                    description: "Bank connection deleted successfully",
                });
            } else {
                const errorData = await response.json();
                toast({
                    title: "Error",
                    description:
                        errorData.error || "Failed to delete bank connection",
                    type: "error",
                });
            }
        } catch (error) {
            console.error("Error deleting bank connection:", error);
            toast({
                title: "Error",
                description:
                    error instanceof Error
                        ? error.message
                        : "Failed to delete bank connection",
                type: "error",
            });
        }
    };

    const saveSettings = async () => {
        try {
            const settingsToSave = {
                ...editingSettings,
                defaultPaidBy:
                    editingSettings.defaultPaidBy === "none"
                        ? null
                        : editingSettings.defaultPaidBy,
            };
            const response = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settingsToSave),
            });

            const data = await response.json();
            if (data.success) {
                setSettings(data.settings);
                setShowSettings(false);
                toast({
                    title: "Success",
                    description: "Settings saved successfully!",
                    type: "success",
                });
            } else {
                toast({
                    title: "Error",
                    description: `Failed to save settings: ${data.error || "Unknown error"}`,
                    type: "error",
                });
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({
                title: "Error",
                description: `Error saving settings: ${error instanceof Error ? error.message : "Unknown error"}`,
                type: "error",
            });
        }
    };

    const toggleTransactionExpand = (transactionId: string) => {
        if (expandedTransaction === transactionId) {
            setExpandedTransaction(null);
        } else {
            setExpandedTransaction(transactionId);
            // Initialize quick import data with defaults
            if (!quickImport[transactionId]) {
                const defaultUser = users.find((u) => u.isActive);
                setQuickImport({
                    ...quickImport,
                    [transactionId]: {
                        categoryId: "",
                        paidBy:
                            settings?.defaultPaidBy || defaultUser?.id || "",
                        type: (settings?.defaultType || "shared") as
                            | "shared"
                            | "personal",
                    },
                });
            }
            // Initialize quick income import with defaults
            if (!quickIncomeImport[transactionId]) {
                const defaultUser = users.find((u) => u.isActive);
                setQuickIncomeImport({
                    ...quickIncomeImport,
                    [transactionId]: {
                        incomeType: "",
                        userId: defaultUser?.id || "",
                    },
                });
            }
        }
    };

    const updateQuickImport = (
        transactionId: string,
        field: string,
        value: string,
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
            toast({
                title: "Error",
                description: "Please select a category",
                type: "error",
            });
            return;
        }

        const amount = Math.abs(transaction.amount);
        let splits;

        if (importData.type === "personal") {
            // Personal expense - assign full amount to payer
            splits = users.map((user) => ({
                userId: user.id,
                amount: user.id === importData.paidBy ? amount : 0,
                paid: true,
            }));
        } else {
            // Shared expense - split by ratios
            const totalRatio = users.reduce((sum, u) => sum + u.ratio, 0);
            splits = users.map((user) => ({
                userId: user.id,
                amount: (amount * user.ratio) / totalRatio,
                paid: true,
            }));
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

    const importIncomeInline = async (transaction: Transaction) => {
        const importData = quickIncomeImport[transaction.transactionId];
        if (!importData || !importData.incomeType) {
            toast({
                title: "Error",
                description: "Please select an income type",
                type: "error",
            });
            return;
        }

        const amount = Math.abs(transaction.amount);

        try {
            const response = await fetch("/api/income", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: importData.userId,
                    date: transaction.date,
                    description: `${importData.incomeType} - ${transaction.name}`,
                    type: importData.incomeType,
                    amount: amount,
                    currency: transaction.currency || "EUR",
                }),
            });

            const data = await response.json();
            if (data.success) {
                // Link transaction to income
                await fetch("/api/plaid/transactions", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        transactionId: transaction.transactionId,
                        linkedToIncome: true,
                        incomeId: data.income.id,
                    }),
                });

                await fetchTransactions();
                setExpandedTransaction(null);
                // Remove from quickIncomeImport
                const newQuickImport = { ...quickIncomeImport };
                delete newQuickImport[transaction.transactionId];
                setQuickIncomeImport(newQuickImport);
            }
        } catch (error) {
            console.error("Error importing income:", error);
        }
    };

    const updateQuickIncomeImport = (
        transactionId: string,
        field: string,
        value: string,
    ) => {
        setQuickIncomeImport({
            ...quickIncomeImport,
            [transactionId]: {
                ...quickIncomeImport[transactionId],
                [field]: value,
            },
        });
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
                            Set default values for quick transaction import.
                            <Link
                                href="/settings"
                                className="ml-2 text-primary underline"
                            >
                                Manage household members
                            </Link>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <Label className="block mb-2">
                                    Default Paid By
                                </Label>
                                <Select
                                    value={editingSettings.defaultPaidBy}
                                    onValueChange={(value) =>
                                        setEditingSettings({
                                            ...editingSettings,
                                            defaultPaidBy: value,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="None" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            None
                                        </SelectItem>
                                        {users.map((user) => (
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
                            <div>
                                <Label className="block mb-2">
                                    Default Type
                                </Label>
                                <Select
                                    value={editingSettings.defaultType}
                                    onValueChange={(value) =>
                                        setEditingSettings({
                                            ...editingSettings,
                                            defaultType: value,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
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
                            </div>
                            <div>
                                <Label className="block mb-2">
                                    Default Split Type
                                </Label>
                                <Select
                                    value={editingSettings.defaultSplitType}
                                    onValueChange={(value) =>
                                        setEditingSettings({
                                            ...editingSettings,
                                            defaultSplitType: value,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="equal">
                                            Equal
                                        </SelectItem>
                                        <SelectItem value="ratio">
                                            By Ratio
                                        </SelectItem>
                                        <SelectItem value="custom">
                                            Custom
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
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
                                    {transactions.map((transaction) => {
                                        const isExpense =
                                            transaction.amount > 0;

                                        const isTracked =
                                            transaction.linkedToExpense ||
                                            transaction.linkedToIncome;

                                        return (
                                            <div
                                                key={transaction.id}
                                                className={`border rounded-lg overflow-hidden ${
                                                    isTracked
                                                        ? "bg-green-50 border-green-200"
                                                        : ""
                                                }`}
                                            >
                                                <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                                                    <div className="flex items-center gap-3 flex-1">
                                                        {isTracked ? (
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
                                                                {
                                                                    transaction.name
                                                                }
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
                                                            {transaction.amount >
                                                            0
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
                                                                (Expense)
                                                            </p>
                                                        )}
                                                        {transaction.linkedToIncome && (
                                                            <p className="text-xs text-green-600 font-medium">
                                                                Tracked (Income)
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {expandedTransaction ===
                                                    transaction.transactionId &&
                                                    !isTracked && (
                                                        <div className="px-3 pb-3 pt-2 bg-muted/30 border-t">
                                                            <p className="text-xs font-medium mb-2 text-muted-foreground">
                                                                {isExpense
                                                                    ? "Quick Import to Expenses"
                                                                    : "Quick Import to Income"}
                                                            </p>
                                                            {isExpense ? (
                                                                <>
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        <Select
                                                                            value={
                                                                                quickImport[
                                                                                    transaction
                                                                                        .transactionId
                                                                                ]
                                                                                    ?.categoryId ||
                                                                                ""
                                                                            }
                                                                            onValueChange={(
                                                                                value,
                                                                            ) =>
                                                                                updateQuickImport(
                                                                                    transaction.transactionId,
                                                                                    "categoryId",
                                                                                    value,
                                                                                )
                                                                            }
                                                                        >
                                                                            <SelectTrigger className="h-8 text-sm">
                                                                                <SelectValue placeholder="Category..." />
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
                                                                                quickImport[
                                                                                    transaction
                                                                                        .transactionId
                                                                                ]
                                                                                    ?.paidBy ||
                                                                                settings?.defaultPaidBy ||
                                                                                ""
                                                                            }
                                                                            onValueChange={(
                                                                                value,
                                                                            ) =>
                                                                                updateQuickImport(
                                                                                    transaction.transactionId,
                                                                                    "paidBy",
                                                                                    value,
                                                                                )
                                                                            }
                                                                        >
                                                                            <SelectTrigger className="h-8 text-sm">
                                                                                <SelectValue placeholder="Paid By..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {users.map(
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
                                                                        <Select
                                                                            value={
                                                                                quickImport[
                                                                                    transaction
                                                                                        .transactionId
                                                                                ]
                                                                                    ?.type ||
                                                                                settings?.defaultType ||
                                                                                "shared"
                                                                            }
                                                                            onValueChange={(
                                                                                value,
                                                                            ) =>
                                                                                updateQuickImport(
                                                                                    transaction.transactionId,
                                                                                    "type",
                                                                                    value,
                                                                                )
                                                                            }
                                                                        >
                                                                            <SelectTrigger className="h-8 text-sm">
                                                                                <SelectValue />
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
                                                                            Split
                                                                            by
                                                                            ratio:{" "}
                                                                            {users
                                                                                .map(
                                                                                    (
                                                                                        u,
                                                                                    ) =>
                                                                                        `${u.name} ${Math.round(u.ratio * 100)}%`,
                                                                                )
                                                                                .join(
                                                                                    ", ",
                                                                                )}
                                                                        </p>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <Select
                                                                            value={
                                                                                quickIncomeImport[
                                                                                    transaction
                                                                                        .transactionId
                                                                                ]
                                                                                    ?.incomeType ||
                                                                                ""
                                                                            }
                                                                            onValueChange={(
                                                                                value,
                                                                            ) =>
                                                                                updateQuickIncomeImport(
                                                                                    transaction.transactionId,
                                                                                    "incomeType",
                                                                                    value,
                                                                                )
                                                                            }
                                                                        >
                                                                            <SelectTrigger className="h-8 text-sm">
                                                                                <SelectValue placeholder="Income Type..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {incomeTypes.map(
                                                                                    (
                                                                                        type,
                                                                                    ) => (
                                                                                        <SelectItem
                                                                                            key={
                                                                                                type
                                                                                            }
                                                                                            value={
                                                                                                type
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                type
                                                                                            }
                                                                                        </SelectItem>
                                                                                    ),
                                                                                )}
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <Select
                                                                            value={
                                                                                quickIncomeImport[
                                                                                    transaction
                                                                                        .transactionId
                                                                                ]
                                                                                    ?.userId ||
                                                                                ""
                                                                            }
                                                                            onValueChange={(
                                                                                value,
                                                                            ) =>
                                                                                updateQuickIncomeImport(
                                                                                    transaction.transactionId,
                                                                                    "userId",
                                                                                    value,
                                                                                )
                                                                            }
                                                                        >
                                                                            <SelectTrigger className="h-8 text-sm">
                                                                                <SelectValue placeholder="For..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {users.map(
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
                                                                    </div>
                                                                    <div className="flex gap-2 mt-2">
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                importIncomeInline(
                                                                                    transaction,
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                !quickIncomeImport[
                                                                                    transaction
                                                                                        .transactionId
                                                                                ]
                                                                                    ?.incomeType
                                                                            }
                                                                            className="flex-1"
                                                                        >
                                                                            <Check className="mr-1 h-3 w-3" />
                                                                            Track
                                                                            Income
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
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                            </div>
                                        );
                                    })}
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
