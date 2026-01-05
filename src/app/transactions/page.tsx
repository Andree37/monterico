"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Check, X } from "lucide-react";
import { useAccountingMode } from "@/hooks/use-accounting-mode";

interface Category {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
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
    incomeType?: string;
}

export default function TransactionsPage() {
    const { accountingMode, settings } = useAccountingMode();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFilter, setSelectedFilter] = useState<string>("all");
    const [importData, setImportData] = useState<{ [key: string]: ImportData }>(
        {},
    );

    const loadTransactions = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/plaid/transactions");
            if (response.ok) {
                const data = await response.json();
                setTransactions(data.transactions || []);
            }
        } catch (error) {
            console.error("Error loading transactions:", error);
        } finally {
            setLoading(false);
        }
    };

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

    useEffect(() => {
        const init = async () => {
            await Promise.all([
                loadTransactions(),
                loadCategories(),
                loadUsers(),
            ]);
        };
        init();
    }, []);

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
                    const result = await response.json();
                    toast.success("Transaction imported as expense");

                    // Update only the affected transaction in state
                    setTransactions((prevTransactions) =>
                        prevTransactions.map((t) =>
                            t.transactionId === transaction.transactionId
                                ? {
                                      ...t,
                                      linkedToExpense: true,
                                      expenseId: result.expense.id,
                                  }
                                : t,
                        ),
                    );
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
                        amount: Math.abs(transaction.amount),
                        currency: transaction.currency || "EUR",
                        userId: data.paidById,
                        type: data.incomeType || "salary",
                        transactionId: transaction.transactionId,
                    }),
                });

                if (response.ok) {
                    const result = await response.json();
                    toast.success("Transaction imported as income");

                    // Update only the affected transaction in state
                    setTransactions((prevTransactions) =>
                        prevTransactions.map((t) =>
                            t.transactionId === transaction.transactionId
                                ? {
                                      ...t,
                                      linkedToIncome: true,
                                      incomeId: result.income.id,
                                  }
                                : t,
                        ),
                    );
                }
            }
        } catch {
            toast.error("Failed to import transaction");
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
                    toast.error("Failed to delete associated expense");
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
                    toast.error("Failed to delete associated income");
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
                toast.success(
                    "Transaction unlinked and expense/income deleted",
                );

                setTransactions((prevTransactions) =>
                    prevTransactions.map((t) =>
                        t.transactionId === transactionId
                            ? {
                                  ...t,
                                  linkedToExpense: false,
                                  expenseId: null,
                                  linkedToIncome: false,
                                  incomeId: null,
                              }
                            : t,
                    ),
                );
            }
        } catch {
            toast.error("Failed to unlink transaction");
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
            <div className="space-y-4">
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
                                Not Imported
                            </SelectItem>
                            <SelectItem value="linked">Imported</SelectItem>
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
                                                    • {transaction.account.name}
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
                                                                ]?.isPersonal
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
                                                            ]?.isPersonal && (
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
                                                                    <SelectTrigger className="w-40">
                                                                        <SelectValue placeholder="Payment Source" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="pool">
                                                                            Paid
                                                                            from
                                                                            Pool
                                                                        </SelectItem>
                                                                        <SelectItem value="pending">
                                                                            Needs
                                                                            Reimbursement
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            )}

                                                        <Select
                                                            value={
                                                                importData[
                                                                    transaction
                                                                        .transactionId
                                                                ]?.categoryId ||
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
                                                                    (cat) => (
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
                                                                ]?.paidById ||
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
                                                                    (user) => (
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
                                                            type="button"
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
                                                                ]?.categoryId ||
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
                                                                ]?.incomeType ||
                                                                "salary"
                                                            }
                                                            onValueChange={(
                                                                value,
                                                            ) =>
                                                                handleImportDataChange(
                                                                    transaction.transactionId,
                                                                    "incomeType",
                                                                    value,
                                                                )
                                                            }
                                                        >
                                                            <SelectTrigger className="w-32">
                                                                <SelectValue placeholder="Type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="salary">
                                                                    Salary
                                                                </SelectItem>
                                                                <SelectItem value="extras">
                                                                    Extras
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>

                                                        <Select
                                                            value={
                                                                importData[
                                                                    transaction
                                                                        .transactionId
                                                                ]?.paidById ||
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
                                                                    (user) => (
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
                                                            type="button"
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
            </div>
        </div>
    );
}
