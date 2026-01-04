"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAccountingMode } from "@/hooks/use-accounting-mode";
import { AccountingModeIndicator } from "@/components/AccountingModeIndicator";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CustomSplitsInput from "@/components/expenses/CustomSplitsInput";
import { formatCurrency, formatDate as formatDateUtil } from "@/lib/utils";

interface Category {
    id: string;
    name: string;
    color: string | null;
    icon: string;
}

interface User {
    id: string;
    name: string;
    email: string | null;
    ratio?: number;
    isActive?: boolean;
}

interface ExpenseSplit {
    id: string;
    userId: string;
    amount: number;
    paid: boolean;
    user: User;
}

interface Expense {
    id: string;
    date: string;
    description: string;
    amount: number;
    currency: string;
    type: string;
    paid: boolean;
    category: Category;
    paidBy: User;
    splits: ExpenseSplit[];
}

interface Split {
    userId: string;
    amount: number;
}

export default function IndividualExpensesPage() {
    const router = useRouter();
    const {
        accountingMode,
        loading: modeLoading,
        getExpenseEndpoint,
    } = useAccountingMode();

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>("all");
    const [selectedYear, setSelectedYear] = useState<string>(
        new Date().getFullYear().toString(),
    );
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [customSplits, setCustomSplits] = useState<Split[]>([]);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        description: "",
        categoryId: "",
        amount: "0",
        paidById: "",
        type: "shared",
        splitType: "equal" as "equal" | "ratio" | "custom",
    });

    // Redirect if wrong mode
    useEffect(() => {
        if (!modeLoading && accountingMode !== "individual") {
            router.replace("/expenses/shared-pool");
        }
    }, [accountingMode, modeLoading, router]);

    useEffect(() => {
        if (accountingMode === "individual") {
            fetchExpenses();
            fetchCategories();
            fetchUsers();
        }
    }, [accountingMode]);

    // Initialize custom splits when users or amount changes
    useEffect(() => {
        if (users.length > 0 && formData.amount) {
            const amount = parseFloat(formData.amount) || 0;
            const activeUsers = users.filter((u) => u.isActive);

            if (formData.splitType === "equal") {
                const splitAmount = amount / activeUsers.length;
                setCustomSplits(
                    activeUsers.map((u) => ({
                        userId: u.id,
                        amount: splitAmount,
                    })),
                );
            } else if (formData.splitType === "ratio") {
                const totalRatio = activeUsers.reduce(
                    (sum, u) => sum + (u.ratio || 1),
                    0,
                );
                setCustomSplits(
                    activeUsers.map((u) => ({
                        userId: u.id,
                        amount: (amount * (u.ratio || 1)) / totalRatio,
                    })),
                );
            }
        }
    }, [users, formData.amount, formData.splitType]);

    // Set default paidBy when users are loaded
    useEffect(() => {
        if (users.length > 0 && !formData.paidById) {
            const activeUser = users.find((u) => u.isActive);
            if (activeUser) {
                setFormData((prev) => ({ ...prev, paidById: activeUser.id }));
            }
        }
    }, [users, formData.paidById]);

    const fetchUsers = async () => {
        try {
            const response = await fetch("/api/users");
            const data = await response.json();
            setUsers(data);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    const fetchExpenses = async () => {
        try {
            const response = await fetch("/api/expenses");
            const data = await response.json();
            if (data.success) {
                setExpenses(data.expenses);
            }
        } catch (error) {
            console.error("Error fetching expenses:", error);
        } finally {
            setLoading(false);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const amount = parseFloat(formData.amount);

        if (formData.splitType === "custom") {
            const totalSplit = customSplits.reduce(
                (sum, s) => sum + s.amount,
                0,
            );
            if (Math.abs(totalSplit - amount) > 0.01) {
                toast({
                    title: "Error",
                    description: "Splits must sum to the total amount",
                    type: "error",
                });
                return;
            }
        }

        try {
            const endpoint = getExpenseEndpoint();

            const requestBody = {
                date: formData.date,
                description: formData.description,
                categoryId: formData.categoryId,
                amount: amount,
                currency: "EUR",
                paidById: formData.paidById,
                type: formData.type,
                splitType: formData.splitType,
                customSplits:
                    formData.splitType === "custom"
                        ? customSplits.map((split) => ({
                              userId: split.userId,
                              amount: split.amount,
                          }))
                        : undefined,
            };

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (data.success) {
                await fetchExpenses();
                setShowAddDialog(false);

                toast({
                    title: "Success",
                    description: "Expense added successfully",
                });

                const activeUser = users.find((u) => u.isActive);
                setFormData({
                    date: new Date().toISOString().split("T")[0],
                    description: "",
                    categoryId: "",
                    amount: "0",
                    paidById: activeUser?.id || "",
                    type: "shared",
                    splitType: "equal",
                });
                setCustomSplits([]);
            } else {
                toast({
                    title: "Error",
                    description: data.error || "Failed to add expense",
                    type: "error",
                });
            }
        } catch (error) {
            console.error("Error creating expense:", error);
            toast({
                title: "Error",
                description: "An unexpected error occurred",
                type: "error",
            });
        }
    };

    const togglePaid = async (expenseId: string, currentPaid: boolean) => {
        try {
            const response = await fetch("/api/expenses", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: expenseId,
                    paid: !currentPaid,
                }),
            });

            if (response.ok) {
                await fetchExpenses();
            }
        } catch (error) {
            console.error("Error updating expense:", error);
        }
    };

    const getMonthKey = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    };

    const filteredExpenses = expenses.filter((exp) => {
        const expenseMonthKey = getMonthKey(exp.date);
        const [expenseYear, expenseMonth] = expenseMonthKey.split("-");

        const yearMatch = expenseYear === selectedYear;
        const monthMatch =
            selectedMonth === "all" || expenseMonth === selectedMonth;
        const categoryMatch =
            selectedCategory === "all" || exp.category.id === selectedCategory;
        return yearMatch && monthMatch && categoryMatch;
    });

    // Generate last 12 months for filtering
    const now = new Date();
    const generatedMonths = [];
    for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        generatedMonths.push(`${year}-${month}`);
    }

    const availableMonths = Array.from(
        new Set([
            ...generatedMonths,
            ...expenses.map((exp) => getMonthKey(exp.date)),
        ]),
    ).sort((a, b) => b.localeCompare(a));

    const availableYears = Array.from(
        new Set(availableMonths.map((m) => m.split("-")[0])),
    ).sort((a, b) => b.localeCompare(a));

    const availableMonthsInYear = Array.from(
        new Set(
            availableMonths
                .filter((m) => m.startsWith(selectedYear))
                .map((m) => m.split("-")[1]),
        ),
    ).sort();

    const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

    const activeUsers = users.filter((u) => u.isActive);

    const calculateStats = (useFilteredExpenses = true) => {
        const expensesForStats = useFilteredExpenses
            ? filteredExpenses
            : expenses;

        const userTotals: { [userId: string]: number } = {};
        activeUsers.forEach((user) => {
            userTotals[user.id] = expensesForStats.reduce((sum, exp) => {
                const userSplit = exp.splits.find((s) => s.userId === user.id);
                return sum + (userSplit?.amount || 0);
            }, 0);
        });

        const total = Object.values(userTotals).reduce(
            (sum, val) => sum + val,
            0,
        );

        const unpaidSharedExpenses = expenses.filter(
            (exp) => !exp.paid && exp.type === "shared",
        );

        const userBalances: { [userId: string]: number } = {};
        activeUsers.forEach((user) => {
            userBalances[user.id] = 0;
        });

        unpaidSharedExpenses.forEach((exp) => {
            exp.splits.forEach((split) => {
                if (split.userId !== exp.paidBy.id) {
                    userBalances[split.userId] =
                        (userBalances[split.userId] || 0) - split.amount;
                    userBalances[exp.paidBy.id] =
                        (userBalances[exp.paidBy.id] || 0) + split.amount;
                }
            });
        });

        return { userTotals, userBalances, total };
    };

    const allTimeStats = calculateStats(false);

    if (modeLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (accountingMode !== "individual") {
        return null;
    }

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight">
                            Individual Expenses
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Track expenses with individual account splits
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Link href="/settings">
                        <Button variant="outline">
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </Button>
                    </Link>
                    <Dialog
                        open={showAddDialog}
                        onOpenChange={setShowAddDialog}
                    >
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Expense
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Add New Expense</DialogTitle>
                                <DialogDescription>
                                    Create a new expense with individual splits
                                </DialogDescription>
                            </DialogHeader>

                            <AccountingModeIndicator />

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <Label>Date</Label>
                                    <Input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                date: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>

                                <div>
                                    <Label>Description</Label>
                                    <Input
                                        value={formData.description}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                description: e.target.value,
                                            })
                                        }
                                        placeholder="Grocery shopping"
                                        required
                                    />
                                </div>

                                <div>
                                    <Label>Category</Label>
                                    <Select
                                        value={formData.categoryId}
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                categoryId: value,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
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
                                </div>

                                <div>
                                    <Label>Amount (€)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                amount: e.target.value,
                                            })
                                        }
                                        placeholder="0.00"
                                        required
                                    />
                                </div>

                                <div>
                                    <Label>Paid By</Label>
                                    <Select
                                        value={formData.paidById}
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                paidById: value,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select user" />
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

                                <div>
                                    <Label>Type</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                type: value,
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

                                {formData.type === "shared" && (
                                    <>
                                        <div>
                                            <Label>Split Type</Label>
                                            <Select
                                                value={formData.splitType}
                                                onValueChange={(value) =>
                                                    setFormData({
                                                        ...formData,
                                                        splitType: value as
                                                            | "equal"
                                                            | "ratio"
                                                            | "custom",
                                                    })
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="equal">
                                                        Equal Split
                                                    </SelectItem>
                                                    <SelectItem value="ratio">
                                                        By Ratio
                                                    </SelectItem>
                                                    <SelectItem value="custom">
                                                        Custom Split
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {formData.splitType === "custom" && (
                                            <div>
                                                <Label>Custom Splits</Label>
                                                <CustomSplitsInput
                                                    users={activeUsers}
                                                    splits={customSplits}
                                                    onSplitsChange={
                                                        setCustomSplits
                                                    }
                                                    totalAmount={
                                                        parseFloat(
                                                            formData.amount,
                                                        ) || 0
                                                    }
                                                    splitType={
                                                        formData.splitType
                                                    }
                                                />
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowAddDialog(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit">Add Expense</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="expenses">Expenses</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Total Expenses
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">
                                    {formatCurrency(allTimeStats.total)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    All-time
                                </p>
                            </CardContent>
                        </Card>

                        {activeUsers.map((user) => (
                            <Card key={user.id}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        {user.name} Total
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">
                                        {formatCurrency(
                                            allTimeStats.userTotals[user.id] ||
                                                0,
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {(
                                            ((allTimeStats.userTotals[
                                                user.id
                                            ] || 0) /
                                                allTimeStats.total) *
                                                100 || 0
                                        ).toFixed(1)}
                                        % of total
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Balances</CardTitle>
                            <CardDescription>
                                Who owes whom for unpaid expenses
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {(() => {
                                    const balances = activeUsers.map(
                                        (user) => ({
                                            user,
                                            balance:
                                                allTimeStats.userBalances[
                                                    user.id
                                                ] || 0,
                                        }),
                                    );

                                    const debtor = balances.find(
                                        (b) => b.balance < 0,
                                    );
                                    const creditor = balances.find(
                                        (b) => b.balance > 0,
                                    );

                                    if (
                                        !debtor ||
                                        !creditor ||
                                        debtor.balance === 0
                                    ) {
                                        return (
                                            <div className="p-3 bg-muted/50 rounded text-center text-muted-foreground">
                                                All settled up!
                                            </div>
                                        );
                                    }

                                    const amount = Math.abs(debtor.balance);

                                    return (
                                        <div className="p-4 bg-muted/50 rounded">
                                            <div className="text-center">
                                                <span className="font-semibold text-red-600">
                                                    {debtor.user.name}
                                                </span>
                                                <span className="mx-2 text-muted-foreground">
                                                    owes
                                                </span>
                                                <span className="font-semibold text-green-600">
                                                    {creditor.user.name}
                                                </span>
                                            </div>
                                            <div className="text-center mt-2 text-2xl font-bold">
                                                {formatCurrency(amount)}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Spending Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {activeUsers.map((user) => {
                                    const userTotal =
                                        allTimeStats.userTotals[user.id] || 0;
                                    const percentage =
                                        allTimeStats.total > 0
                                            ? (userTotal / allTimeStats.total) *
                                              100
                                            : 0;
                                    return (
                                        <div
                                            key={user.id}
                                            className="space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">
                                                    {user.name}
                                                </span>
                                                <span className="text-sm text-muted-foreground">
                                                    {percentage.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary transition-all"
                                                    style={{
                                                        width: `${percentage}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="expenses" className="space-y-6">
                    <div className="flex gap-4 flex-wrap">
                        <div>
                            <Label className="block mb-2">Year</Label>
                            <Select
                                value={selectedYear}
                                onValueChange={(value) => {
                                    setSelectedYear(value);
                                    setSelectedMonth("all");
                                }}
                            >
                                <SelectTrigger className="w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableYears.map((year) => (
                                        <SelectItem key={year} value={year}>
                                            {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="block mb-2">Month</Label>
                            <Select
                                value={selectedMonth}
                                onValueChange={setSelectedMonth}
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="All Months" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Months
                                    </SelectItem>
                                    {availableMonthsInYear.map((monthNum) => {
                                        const monthIndex =
                                            parseInt(monthNum) - 1;
                                        return (
                                            <SelectItem
                                                key={monthNum}
                                                value={monthNum}
                                            >
                                                {monthNames[monthIndex]}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="block mb-2">Category</Label>
                            <Select
                                value={selectedCategory}
                                onValueChange={setSelectedCategory}
                            >
                                <SelectTrigger className="w-45">
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Categories
                                    </SelectItem>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            {cat.icon} {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Expenses ({filteredExpenses.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {filteredExpenses.map((expense) => (
                                    <div
                                        key={expense.id}
                                        className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="text-xl shrink-0">
                                                {expense.category.icon}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-sm truncate">
                                                        {expense.description}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDateUtil(
                                                        expense.date,
                                                    )}{" "}
                                                    • {expense.category.name} •{" "}
                                                    {expense.paidBy.name}
                                                </p>
                                                <div className="flex gap-1 mt-1 flex-wrap">
                                                    {expense.splits.map(
                                                        (split) => (
                                                            <span
                                                                key={split.id}
                                                                className="text-xs bg-muted px-1.5 py-0.5 rounded"
                                                            >
                                                                {
                                                                    split.user
                                                                        .name
                                                                }
                                                                :{" "}
                                                                {formatCurrency(
                                                                    split.amount,
                                                                )}
                                                            </span>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0 ml-4">
                                            <div className="text-right">
                                                <p className="font-semibold text-sm">
                                                    {formatCurrency(
                                                        expense.amount,
                                                    )}
                                                </p>
                                                <p className="text-xs text-muted-foreground capitalize">
                                                    {expense.type}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                                <input
                                                    type="checkbox"
                                                    checked={expense.paid}
                                                    onChange={() =>
                                                        togglePaid(
                                                            expense.id,
                                                            expense.paid,
                                                        )
                                                    }
                                                    className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {filteredExpenses.length === 0 && (
                                    <p className="text-center text-muted-foreground py-8">
                                        No expenses found
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
