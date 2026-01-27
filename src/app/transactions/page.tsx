"use client";

import { useEffect, useState, useCallback, useMemo, memo } from "react";
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
        accountType: string | null;
        ownerId: string | null;
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
    allocatedToMonth?: string;
    transactionType?:
        | "personal_expense"
        | "investment"
        | "salary"
        | "other_income"
        | "shared_expense"
        | "savings"
        | "joint_income";
}

interface TransactionRowProps {
    transaction: Transaction;
    categories: Category[];
    activeUsers: User[];
    importData: ImportData | undefined;
    onImportDataChange: (
        field: keyof ImportData,
        value: string | boolean,
    ) => void;
    onImport: () => void;
    onUnlink: () => void;
}

function getDefaultAllocatedMonth(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDate();

    if (day > 22) {
        date.setMonth(date.getMonth() + 1);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

const TransactionRow = memo(function TransactionRow({
    transaction,
    categories,
    activeUsers,
    importData,
    onImportDataChange,
    onImport,
    onUnlink,
}: TransactionRowProps) {
    const isPersonalAccount = transaction.account.accountType === "personal";
    const isJointAccount = transaction.account.accountType === "joint";
    const isExpense = transaction.amount < 0;
    const isIncome = transaction.amount > 0;
    const accountOwner = transaction.account.ownerId;

    const ownerName = accountOwner
        ? activeUsers.find((u) => u.id === accountOwner)?.name || "Owner"
        : null;

    const renderImportControls = () => {
        if (isPersonalAccount && isExpense) {
            return (
                <>
                    <Select
                        value={
                            importData?.transactionType || "personal_expense"
                        }
                        onValueChange={(value) =>
                            onImportDataChange("transactionType", value)
                        }
                    >
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="personal_expense">
                                Personal Expense
                            </SelectItem>
                            <SelectItem value="investment">
                                Investment
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    {importData?.transactionType !== "investment" &&
                        (categories.length > 0 ? (
                            <Select
                                value={importData?.categoryId || ""}
                                onValueChange={(value) =>
                                    onImportDataChange("categoryId", value)
                                }
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            {cat.icon} {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <div className="w-40 px-3 py-2 text-xs border rounded-md bg-yellow-50 text-yellow-800">
                                No categories
                            </div>
                        ))}

                    {ownerName && (
                        <div className="w-32 px-3 py-2 text-sm border rounded-md bg-muted">
                            {ownerName}
                        </div>
                    )}

                    <Button
                        type="button"
                        size="sm"
                        className="w-20"
                        onClick={() => {
                            console.log("Import clicked", {
                                transactionType: importData?.transactionType,
                                categoryId: importData?.categoryId,
                                paidById: importData?.paidById,
                                categories: categories.length,
                            });
                            onImport();
                        }}
                        disabled={
                            importData?.transactionType !== "investment" &&
                            (categories.length === 0 || !importData?.categoryId)
                        }
                    >
                        Import
                    </Button>
                </>
            );
        }

        if (isPersonalAccount && isIncome) {
            return (
                <>
                    <Select
                        value={importData?.transactionType || "salary"}
                        onValueChange={(value) =>
                            onImportDataChange("transactionType", value)
                        }
                    >
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="salary">Salary</SelectItem>
                            <SelectItem value="other_income">
                                Other Income
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    {importData?.transactionType === "salary" && (
                        <>
                            <Select
                                value={
                                    importData?.allocatedToMonth ||
                                    getDefaultAllocatedMonth(transaction.date)
                                }
                                onValueChange={(value) =>
                                    onImportDataChange(
                                        "allocatedToMonth",
                                        value,
                                    )
                                }
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(() => {
                                        const months = [];
                                        const now = new Date();
                                        for (let i = -1; i <= 2; i++) {
                                            const date = new Date(
                                                now.getFullYear(),
                                                now.getMonth() + i,
                                                1,
                                            );
                                            const year = date.getFullYear();
                                            const month = String(
                                                date.getMonth() + 1,
                                            ).padStart(2, "0");
                                            const monthKey = `${year}-${month}`;
                                            const monthName =
                                                date.toLocaleDateString(
                                                    "en-IE",
                                                    {
                                                        month: "short",
                                                        year: "numeric",
                                                    },
                                                );
                                            months.push(
                                                <SelectItem
                                                    key={monthKey}
                                                    value={monthKey}
                                                >
                                                    {monthName}
                                                </SelectItem>,
                                            );
                                        }
                                        return months;
                                    })()}
                                </SelectContent>
                            </Select>
                        </>
                    )}

                    {ownerName && (
                        <div className="w-40 px-3 py-2 text-sm border rounded-md bg-muted">
                            {ownerName}
                        </div>
                    )}

                    <Button
                        type="button"
                        size="sm"
                        className="w-20"
                        onClick={onImport}
                    >
                        Import
                    </Button>
                </>
            );
        }

        if (isJointAccount && isExpense) {
            return (
                <>
                    <Select
                        value={importData?.transactionType || "shared_expense"}
                        onValueChange={(value) =>
                            onImportDataChange("transactionType", value)
                        }
                    >
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="shared_expense">
                                Shared Expense
                            </SelectItem>
                            <SelectItem value="savings">
                                Savings/Investment
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    {(importData?.transactionType === "shared_expense" ||
                        importData?.transactionType === "savings") && (
                        <>
                            {categories.length > 0 ? (
                                <Select
                                    value={importData?.categoryId || ""}
                                    onValueChange={(value) =>
                                        onImportDataChange("categoryId", value)
                                    }
                                >
                                    <SelectTrigger className="w-40">
                                        <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((cat) => (
                                            <SelectItem
                                                key={cat.id}
                                                value={cat.id}
                                            >
                                                {cat.icon} {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="w-40 px-3 py-2 text-xs border rounded-md bg-yellow-50 text-yellow-800">
                                    No categories
                                </div>
                            )}

                            <Select
                                value={importData?.paidById || ""}
                                onValueChange={(value) =>
                                    onImportDataChange("paidById", value)
                                }
                            >
                                <SelectTrigger className="w-32">
                                    <SelectValue placeholder="Paid by" />
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
                        </>
                    )}

                    <Button
                        type="button"
                        size="sm"
                        className="w-20"
                        onClick={onImport}
                        disabled={
                            (importData?.transactionType === "shared_expense" ||
                                importData?.transactionType === "savings") &&
                            (categories.length === 0 ||
                                !importData?.categoryId ||
                                !importData?.paidById)
                        }
                    >
                        Import
                    </Button>
                </>
            );
        }

        if (isJointAccount && isIncome) {
            return (
                <>
                    <Select
                        value={importData?.transactionType || "joint_salary"}
                        onValueChange={(value) =>
                            onImportDataChange("transactionType", value)
                        }
                    >
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="joint_income">
                                Joint Income
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={
                            importData?.allocatedToMonth ||
                            getDefaultAllocatedMonth(transaction.date)
                        }
                        onValueChange={(value) =>
                            onImportDataChange("allocatedToMonth", value)
                        }
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                            {(() => {
                                const months = [];
                                const now = new Date();
                                for (let i = -1; i <= 2; i++) {
                                    const date = new Date(
                                        now.getFullYear(),
                                        now.getMonth() + i,
                                        1,
                                    );
                                    const year = date.getFullYear();
                                    const month = String(
                                        date.getMonth() + 1,
                                    ).padStart(2, "0");
                                    const monthKey = `${year}-${month}`;
                                    const monthName = date.toLocaleDateString(
                                        "en-IE",
                                        {
                                            month: "short",
                                            year: "numeric",
                                        },
                                    );
                                    months.push(
                                        <SelectItem
                                            key={monthKey}
                                            value={monthKey}
                                        >
                                            {monthName}
                                        </SelectItem>,
                                    );
                                }
                                return months;
                            })()}
                        </SelectContent>
                    </Select>

                    <Select
                        value={importData?.paidById || ""}
                        onValueChange={(value) =>
                            onImportDataChange("paidById", value)
                        }
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="From whom" />
                        </SelectTrigger>
                        <SelectContent>
                            {activeUsers.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                    {user.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        type="button"
                        size="sm"
                        className="w-20"
                        onClick={onImport}
                        disabled={!importData?.paidById}
                    >
                        Import
                    </Button>
                </>
            );
        }

        return (
            <p className="text-xs text-muted-foreground">
                Account not tagged (personal/joint)
            </p>
        );
    };

    return (
        <Card
            className={
                transaction.linkedToExpense || transaction.linkedToIncome
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
                            {transaction.amount > 0 ? "+" : ""}€
                            {Math.abs(transaction.amount).toFixed(2)}
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
                                {new Date(transaction.date).toLocaleDateString(
                                    "en-GB",
                                )}{" "}
                                • {transaction.account.name}
                                {transaction.account.accountType && (
                                    <span className="ml-1 text-xs bg-gray-100 text-gray-700 px-1 py-0.5 rounded">
                                        {transaction.account.accountType}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {transaction.linkedToExpense ||
                    transaction.linkedToIncome ? (
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onUnlink}
                            >
                                <X className="h-3 w-3 mr-1" />
                                Unlink
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 shrink-0">
                            {renderImportControls()}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
});

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
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

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
                console.log("Categories loaded:", data.categories?.length || 0);
                setCategories(data.categories || []);
            } else {
                console.error("Failed to load categories:", response.status);
            }
        } catch (error) {
            console.error("Error loading categories:", error);
            toast.error("Failed to load categories");
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

    const handleImportDataChange = useCallback(
        (
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
        },
        [],
    );

    const getImportDataWithDefaults = useCallback(
        (transaction: Transaction): ImportData => {
            const existing = importData[transaction.transactionId] || {};
            const defaults: Partial<ImportData> = {
                transactionId: transaction.transactionId,
            };

            if (transaction.account.ownerId) {
                defaults.paidById = transaction.account.ownerId;
            }

            // Set default transaction type based on account type and direction
            if (!existing.transactionType) {
                const isPersonalAccount =
                    transaction.account.accountType === "personal";
                const isJointAccount =
                    transaction.account.accountType === "joint";
                const isExpense = transaction.amount < 0;
                const isIncome = transaction.amount > 0;

                if (isPersonalAccount && isExpense) {
                    defaults.transactionType = "personal_expense";
                } else if (isPersonalAccount && isIncome) {
                    defaults.transactionType = "salary";
                } else if (isJointAccount && isExpense) {
                    defaults.transactionType = "shared_expense";
                } else if (isJointAccount && isIncome) {
                    defaults.transactionType = "joint_income";
                }
            }

            // Set default allocated month for salary transactions
            if (
                (defaults.transactionType === "salary" ||
                    defaults.transactionType === "joint_income" ||
                    existing.transactionType === "salary" ||
                    existing.transactionType === "joint_income") &&
                !existing.allocatedToMonth
            ) {
                defaults.allocatedToMonth = getDefaultAllocatedMonth(
                    transaction.date,
                );
            }

            return { ...defaults, ...existing } as ImportData;
        },
        [importData],
    );

    const importTransaction = useCallback(
        async (transaction: Transaction) => {
            const existing = importData[transaction.transactionId] || {};
            const defaults: Partial<ImportData> = {
                transactionId: transaction.transactionId,
            };

            if (transaction.account.ownerId) {
                defaults.paidById = transaction.account.ownerId;
            }

            // Set default transaction type based on account type and direction
            if (!existing.transactionType) {
                const isPersonalAccount =
                    transaction.account.accountType === "personal";
                const isJointAccount =
                    transaction.account.accountType === "joint";
                const isExpense = transaction.amount < 0;
                const isIncome = transaction.amount > 0;

                if (isPersonalAccount && isExpense) {
                    defaults.transactionType = "personal_expense";
                } else if (isPersonalAccount && isIncome) {
                    defaults.transactionType = "salary";
                } else if (isJointAccount && isExpense) {
                    defaults.transactionType = "shared_expense";
                } else if (isJointAccount && isIncome) {
                    defaults.transactionType = "joint_income";
                }
            }

            const data = { ...defaults, ...existing } as ImportData;

            console.log("Import transaction data:", {
                transactionType: data.transactionType,
                categoryId: data.categoryId,
                paidById: data.paidById,
                accountType: transaction.account.accountType,
            });

            if (!data || !data.transactionType) {
                console.error("Missing transaction type", data);
                toast.error("Please select a transaction type");
                return;
            }

            try {
                const transactionType = data.transactionType;
                const paidById =
                    data.paidById || transaction.account.ownerId || "";

                if (!paidById) {
                    toast.error("No household member assigned");
                    return;
                }

                // Validate category for expense types
                if (
                    transactionType === "personal_expense" ||
                    transactionType === "shared_expense"
                ) {
                    if (categories.length === 0) {
                        toast.error(
                            "No categories found. Please create categories in Settings first.",
                        );
                        return;
                    }
                    if (!data.categoryId) {
                        toast.error("Please select a category");
                        return;
                    }
                }

                switch (transactionType) {
                    case "personal_expense": {
                        const endpoint =
                            accountingMode === "shared_pool"
                                ? "/api/expenses/shared-pool"
                                : "/api/expenses/individual";

                        const response = await fetch(endpoint, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                date: transaction.date,
                                description: transaction.name,
                                categoryId: data.categoryId,
                                amount: Math.abs(transaction.amount),
                                currency: transaction.currency || "EUR",
                                paidById: paidById,
                                type: "personal",
                                transactionId: transaction.transactionId,
                            }),
                        });

                        if (response.ok) {
                            const result = await response.json();
                            toast.success("Personal expense imported");
                            setTransactions((prev) =>
                                prev.map((t) =>
                                    t.transactionId ===
                                    transaction.transactionId
                                        ? {
                                              ...t,
                                              linkedToExpense: true,
                                              expenseId: result.expense.id,
                                          }
                                        : t,
                                ),
                            );
                        }
                        break;
                    }

                    case "investment": {
                        toast.info("Investment tracking not yet implemented");
                        break;
                    }

                    case "salary": {
                        const endpoint =
                            accountingMode === "shared_pool"
                                ? "/api/income/shared-pool"
                                : "/api/income";

                        const allocatedMonth =
                            data.allocatedToMonth ||
                            getDefaultAllocatedMonth(transaction.date);

                        const response = await fetch(endpoint, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                date: transaction.date,
                                description: transaction.name,
                                amount: Math.abs(transaction.amount),
                                currency: transaction.currency || "EUR",
                                householdMemberId: paidById,
                                type: "salary",
                                transactionId: transaction.transactionId,
                                allocatedToMonth: allocatedMonth,
                            }),
                        });

                        if (response.ok) {
                            const result = await response.json();
                            toast.success("Salary imported");
                            setTransactions((prev) =>
                                prev.map((t) =>
                                    t.transactionId ===
                                    transaction.transactionId
                                        ? {
                                              ...t,
                                              linkedToIncome: true,
                                              incomeId: result.income.id,
                                          }
                                        : t,
                                ),
                            );
                        }
                        break;
                    }

                    case "other_income": {
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
                                householdMemberId: paidById,
                                type: "extras",
                                transactionId: transaction.transactionId,
                            }),
                        });

                        if (response.ok) {
                            const result = await response.json();
                            toast.success("Other income imported");
                            setTransactions((prev) =>
                                prev.map((t) =>
                                    t.transactionId ===
                                    transaction.transactionId
                                        ? {
                                              ...t,
                                              linkedToIncome: true,
                                              incomeId: result.income.id,
                                          }
                                        : t,
                                ),
                            );
                        }
                        break;
                    }

                    case "shared_expense": {
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
                            paidById: paidById,
                            type: "shared",
                            transactionId: transaction.transactionId,
                        };

                        if (accountingMode === "shared_pool") {
                            requestBody.paidFromPool = true;
                        } else if (accountingMode === "individual") {
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
                            toast.success("Shared expense imported");
                            setTransactions((prev) =>
                                prev.map((t) =>
                                    t.transactionId ===
                                    transaction.transactionId
                                        ? {
                                              ...t,
                                              linkedToExpense: true,
                                              expenseId: result.expense.id,
                                          }
                                        : t,
                                ),
                            );
                        }
                        break;
                    }

                    case "savings": {
                        toast.info("Savings tracking not yet implemented");
                        break;
                    }

                    case "joint_income": {
                        const endpoint =
                            accountingMode === "shared_pool"
                                ? "/api/income/shared-pool"
                                : "/api/income";

                        const allocatedMonth =
                            data.allocatedToMonth ||
                            getDefaultAllocatedMonth(transaction.date);

                        const response = await fetch(endpoint, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                date: transaction.date,
                                description: transaction.name,
                                amount: Math.abs(transaction.amount),
                                currency: transaction.currency || "EUR",
                                householdMemberId: paidById,
                                type: "salary",
                                transactionId: transaction.transactionId,
                                allocatedToMonth: allocatedMonth,
                            }),
                        });

                        if (response.ok) {
                            const result = await response.json();
                            toast.success("Joint income imported");
                            setTransactions((prev) =>
                                prev.map((t) =>
                                    t.transactionId ===
                                    transaction.transactionId
                                        ? {
                                              ...t,
                                              linkedToIncome: true,
                                              incomeId: result.income.id,
                                          }
                                        : t,
                                ),
                            );
                        }
                        break;
                    }

                    default:
                        toast.error("Unknown transaction type");
                }
            } catch (error) {
                console.error("Import error:", error);
                toast.error("Failed to import transaction");
            }
        },
        [accountingMode, settings, importData, categories],
    );

    const unlinkTransaction = useCallback(
        async (transactionId: string) => {
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
        },
        [transactions],
    );

    const filteredTransactions = useMemo(() => {
        return transactions.filter((t) => {
            if (selectedFilter === "all") return true;
            if (selectedFilter === "unlinked")
                return !t.linkedToExpense && !t.linkedToIncome;
            if (selectedFilter === "linked")
                return t.linkedToExpense || t.linkedToIncome;
            return true;
        });
    }, [transactions, selectedFilter]);

    const activeUsers = useMemo(() => users.filter((u) => u.isActive), [users]);

    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredTransactions.slice(startIndex, endIndex);
    }, [filteredTransactions, currentPage]);

    const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedFilter]);

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
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
                    <div className="text-sm text-muted-foreground">
                        {filteredTransactions.length} total
                        {filteredTransactions.length > ITEMS_PER_PAGE &&
                            ` • Page ${currentPage} of ${totalPages}`}
                    </div>
                </div>

                <Separator />

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="space-y-1">
                            {paginatedTransactions.map((transaction) => (
                                <TransactionRow
                                    key={transaction.transactionId}
                                    transaction={transaction}
                                    categories={categories}
                                    activeUsers={activeUsers}
                                    importData={getImportDataWithDefaults(
                                        transaction,
                                    )}
                                    onImportDataChange={(field, value) =>
                                        handleImportDataChange(
                                            transaction.transactionId,
                                            field,
                                            value,
                                        )
                                    }
                                    onImport={() =>
                                        importTransaction(transaction)
                                    }
                                    onUnlink={() =>
                                        unlinkTransaction(
                                            transaction.transactionId,
                                        )
                                    }
                                />
                            ))}

                            {filteredTransactions.length === 0 && (
                                <div className="text-center py-12 text-muted-foreground">
                                    No transactions found
                                </div>
                            )}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.max(1, p - 1),
                                        )
                                    }
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.min(totalPages, p + 1),
                                        )
                                    }
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
