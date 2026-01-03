"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
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
import CustomSplitsInput from "@/components/expenses/CustomSplitsInput";
import CategoryPieCharts from "@/components/analytics/CategoryPieCharts";
import MonthlyOverviewChart from "@/components/analytics/MonthlyOverviewChart";
import SpendingTrendChart from "@/components/analytics/SpendingTrendChart";
import CategoryComparisonChart from "@/components/analytics/CategoryComparisonChart";
import ExpenseTypeCards from "@/components/analytics/ExpenseTypeCards";
import SummaryCards from "@/components/analytics/SummaryCards";

interface Category {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
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

interface Income {
    id: string;
    userId: string;
    date: string;
    description: string;
    amount: number;
    currency: string;
    type: string;
    user: User;
}

interface Split {
    userId: string;
    amount: number;
}

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>("all");
    const [selectedYear, setSelectedYear] = useState<string>("all");
    const [budgetYear, setBudgetYear] = useState<string>("");
    const [budgetMonthNum, setBudgetMonthNum] = useState<string>("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [customSplits, setCustomSplits] = useState<Split[]>([]);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        description: "",
        categoryId: "",
        amount: "",
        paidById: "",
        type: "shared",
        splitType: "equal" as "equal" | "ratio" | "custom",
    });

    const [editingIncome, setEditingIncome] = useState<{
        [key: string]: string;
    }>({});

    const incomeTypes = ["Salario", "Beneficios", "Extras"];

    useEffect(() => {
        fetchUsers();
        fetchExpenses();
        fetchCategories();
        fetchIncomes();
    }, []);

    // Set initial budget year and month to current
    useEffect(() => {
        if (!budgetYear && !budgetMonthNum) {
            const now = new Date();
            setBudgetYear(now.getFullYear().toString());
            setBudgetMonthNum(String(now.getMonth() + 1).padStart(2, "0"));
        }
    }, [budgetYear, budgetMonthNum]);

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

    const fetchIncomes = async () => {
        try {
            const response = await fetch("/api/income");
            const data = await response.json();
            if (data.success) {
                setIncomes(data.incomes);
            }
        } catch (error) {
            console.error("Error fetching incomes:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const amount = parseFloat(formData.amount);

        // Validate splits for custom type
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

        const splits = customSplits.map((split) => ({
            ...split,
            paid: false,
        }));

        try {
            const response = await fetch("/api/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: formData.date,
                    description: formData.description,
                    categoryId: formData.categoryId,
                    amount: amount,
                    currency: "EUR",
                    paidById: formData.paidById,
                    type: formData.type,
                    splits: splits,
                }),
            });

            const data = await response.json();
            if (data.success) {
                await fetchExpenses();
                setShowAddDialog(false);
                const activeUser = users.find((u) => u.isActive);
                setFormData({
                    date: new Date().toISOString().split("T")[0],
                    description: "",
                    categoryId: "",
                    amount: "",
                    paidById: activeUser?.id || "",
                    type: "shared",
                    splitType: "equal",
                });
                setCustomSplits([]);
            }
        } catch (error) {
            console.error("Error creating expense:", error);
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

    const updateIncome = async (
        userId: string,
        type: string,
        amount: string,
    ) => {
        const numAmount = parseFloat(amount) || 0;

        const monthStart = new Date(budgetMonth + "-01");
        const existingIncome = incomes.find(
            (inc) =>
                inc.userId === userId &&
                inc.type === type &&
                new Date(inc.date).getMonth() === monthStart.getMonth() &&
                new Date(inc.date).getFullYear() === monthStart.getFullYear(),
        );

        try {
            if (existingIncome) {
                if (numAmount === 0) {
                    await fetch(`/api/income?id=${existingIncome.id}`, {
                        method: "DELETE",
                    });
                } else {
                    await fetch("/api/income", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            id: existingIncome.id,
                            userId,
                            date: monthStart.toISOString(),
                            description: `${type} - ${selectedMonth}`,
                            type,
                            amount: numAmount,
                            currency: "EUR",
                        }),
                    });
                }
            } else if (numAmount > 0) {
                await fetch("/api/income", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId,
                        date: monthStart.toISOString(),
                        description: `${type} - ${selectedMonth}`,
                        type,
                        amount: numAmount,
                        currency: "EUR",
                    }),
                });
            }
            await fetchIncomes();
        } catch (error) {
            console.error("Error updating income:", error);
        }
    };

    const getIncomeAmount = (userId: string, type: string): number => {
        if (!budgetMonth) return 0;
        const monthStart = new Date(budgetMonth + "-01");
        return incomes
            .filter(
                (inc) =>
                    inc.userId === userId &&
                    inc.type === type &&
                    new Date(inc.date).getMonth() === monthStart.getMonth() &&
                    new Date(inc.date).getFullYear() ===
                        monthStart.getFullYear(),
            )
            .reduce((sum, inc) => sum + inc.amount, 0);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency: "EUR",
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "2-digit",
        });
    };

    const getMonthKey = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    };

    const getMonthLabel = (monthKey: string) => {
        const [year, month] = monthKey.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        const monthName = date.toLocaleDateString("pt-PT", {
            month: "long",
        });
        return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
    };

    const filteredExpenses = expenses.filter((exp) => {
        const expenseMonthKey = getMonthKey(exp.date);
        const [expenseYear] = expenseMonthKey.split("-");

        const yearMatch =
            selectedYear === "all" || expenseYear === selectedYear;
        const monthMatch =
            selectedMonth === "all" || expenseMonthKey === selectedMonth;
        const categoryMatch =
            selectedCategory === "all" || exp.category.id === selectedCategory;
        return yearMatch && monthMatch && categoryMatch;
    });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const availableMonths = Array.from(
        new Set([
            currentMonth,
            ...expenses.map((exp) => getMonthKey(exp.date)),
        ]),
    ).sort((a, b) => b.localeCompare(a));

    const availableYears = Array.from(
        new Set(availableMonths.map((m) => m.split("-")[0])),
    ).sort((a, b) => b.localeCompare(a));

    // Filter available months by selected year
    const filteredAvailableMonths =
        selectedYear === "all"
            ? availableMonths
            : availableMonths.filter((m) => m.startsWith(selectedYear));

    const budgetMonth =
        budgetYear && budgetMonthNum ? `${budgetYear}-${budgetMonthNum}` : "";

    const monthNames = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
    ];

    const activeUsers = users.filter((u) => u.isActive);

    const calculateStats = (useFilteredExpenses = true) => {
        const expensesForStats = useFilteredExpenses
            ? filteredExpenses
            : expenses;

        const budgetMonthExpenses =
            budgetMonth !== "all"
                ? expenses.filter(
                      (exp) => getMonthKey(exp.date) === budgetMonth,
                  )
                : expenses;

        // Calculate totals per user
        const userTotals: { [userId: string]: number } = {};
        const userBudgetTotals: { [userId: string]: number } = {};

        activeUsers.forEach((user) => {
            userTotals[user.id] = expensesForStats.reduce((sum, exp) => {
                const userSplit = exp.splits.find((s) => s.userId === user.id);
                return sum + (userSplit?.amount || 0);
            }, 0);

            userBudgetTotals[user.id] = budgetMonthExpenses.reduce(
                (sum, exp) => {
                    const userSplit = exp.splits.find(
                        (s) => s.userId === user.id,
                    );
                    return sum + (userSplit?.amount || 0);
                },
                0,
            );
        });

        const total = Object.values(userTotals).reduce(
            (sum, val) => sum + val,
            0,
        );

        // Balance calculation for unpaid shared expenses
        const unpaidSharedExpenses = filteredExpenses.filter(
            (exp) => !exp.paid && exp.type === "shared",
        );

        const userBalances: { [userId: string]: number } = {};
        activeUsers.forEach((user) => {
            userBalances[user.id] = 0;
        });

        unpaidSharedExpenses.forEach((exp) => {
            exp.splits.forEach((split) => {
                if (split.userId !== exp.paidBy.id) {
                    // This user owes the payer their share
                    userBalances[split.userId] =
                        (userBalances[split.userId] || 0) - split.amount;
                    userBalances[exp.paidBy.id] =
                        (userBalances[exp.paidBy.id] || 0) + split.amount;
                }
            });
        });

        // Category totals per user
        const categoryTotals: {
            [key: string]: { [userId: string]: number };
        } = {};

        filteredExpenses.forEach((exp) => {
            if (!categoryTotals[exp.category.name]) {
                categoryTotals[exp.category.name] = {};
                activeUsers.forEach((user) => {
                    categoryTotals[exp.category.name][user.id] = 0;
                });
            }

            exp.splits.forEach((split) => {
                categoryTotals[exp.category.name][split.userId] =
                    (categoryTotals[exp.category.name][split.userId] || 0) +
                    split.amount;
            });
        });

        // Month totals per user
        const monthTotals: {
            [monthKey: string]: {
                totals: { [userId: string]: number };
                byCategory: {
                    [categoryName: string]: { [userId: string]: number };
                };
            };
        } = {};

        filteredExpenses.forEach((exp) => {
            const monthKey = getMonthKey(exp.date);
            if (!monthTotals[monthKey]) {
                monthTotals[monthKey] = { totals: {}, byCategory: {} };
                activeUsers.forEach((user) => {
                    monthTotals[monthKey].totals[user.id] = 0;
                });
            }

            exp.splits.forEach((split) => {
                monthTotals[monthKey].totals[split.userId] =
                    (monthTotals[monthKey].totals[split.userId] || 0) +
                    split.amount;

                if (!monthTotals[monthKey].byCategory[exp.category.name]) {
                    monthTotals[monthKey].byCategory[exp.category.name] = {};
                    activeUsers.forEach((user) => {
                        monthTotals[monthKey].byCategory[exp.category.name][
                            user.id
                        ] = 0;
                    });
                }

                monthTotals[monthKey].byCategory[exp.category.name][
                    split.userId
                ] =
                    (monthTotals[monthKey].byCategory[exp.category.name][
                        split.userId
                    ] || 0) + split.amount;
            });
        });

        return {
            userTotals,
            userBudgetTotals,
            userBalances,
            total,
            categoryTotals,
            monthTotals,
        };
    };

    const stats = calculateStats();

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
                    <Link href="/">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight">
                            Gastos Pessoais
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Track household expenses
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
                                    Create a new expense entry
                                </DialogDescription>
                            </DialogHeader>
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
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                description: e.target.value,
                                            })
                                        }
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
                                        required
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
                                    <Label>Amount (EUR)</Label>
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
                                        required
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
                                                        Custom
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label className="block mb-2">
                                                Splits
                                            </Label>
                                            <CustomSplitsInput
                                                users={activeUsers}
                                                totalAmount={
                                                    parseFloat(
                                                        formData.amount,
                                                    ) || 0
                                                }
                                                splits={customSplits}
                                                onSplitsChange={setCustomSplits}
                                                splitType={formData.splitType}
                                            />
                                        </div>
                                    </>
                                )}

                                <Button type="submit" className="w-full">
                                    Add Expense
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="expenses">Expenses</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="budget">Budget</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Total Expenses
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">
                                    {formatCurrency(stats.total)}
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
                                            stats.userTotals[user.id] || 0,
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {(
                                            ((stats.userTotals[user.id] || 0) /
                                                stats.total) *
                                            100
                                        ).toFixed(1)}
                                        % of total
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Balances */}
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
                                    // Calculate net balances
                                    const balances = activeUsers.map(
                                        (user) => ({
                                            user,
                                            balance:
                                                stats.userBalances[user.id] ||
                                                0,
                                        }),
                                    );

                                    // Find who owes whom
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
                                                All settled up! 🎉
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

                    {/* Spending by User */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Spending Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {activeUsers.map((user) => {
                                    const userTotal =
                                        stats.userTotals[user.id] || 0;
                                    const percentage =
                                        stats.total > 0
                                            ? (userTotal / stats.total) * 100
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
                    {/* Filters */}
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
                                <SelectTrigger className="w-45">
                                    <SelectValue placeholder="All Years" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Years
                                    </SelectItem>
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
                                <SelectTrigger className="w-45">
                                    <SelectValue placeholder="All Months" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Months
                                    </SelectItem>
                                    {filteredAvailableMonths.map((month) => (
                                        <SelectItem key={month} value={month}>
                                            {getMonthLabel(month)}
                                        </SelectItem>
                                    ))}
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

                    {/* Expenses List */}
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Expenses ({filteredExpenses.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {filteredExpenses.map((expense) => (
                                    <div
                                        key={expense.id}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">
                                                    {expense.category.icon}
                                                </span>
                                                <div>
                                                    <p className="font-medium">
                                                        {expense.description}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {formatDate(
                                                            expense.date,
                                                        )}{" "}
                                                        •{" "}
                                                        {expense.category.name}{" "}
                                                        • Paid by{" "}
                                                        {expense.paidBy.name}
                                                    </p>
                                                    <div className="flex gap-2 mt-1">
                                                        {expense.splits.map(
                                                            (split) => (
                                                                <span
                                                                    key={
                                                                        split.id
                                                                    }
                                                                    className="text-xs bg-muted px-2 py-1 rounded"
                                                                >
                                                                    {
                                                                        split
                                                                            .user
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
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="font-semibold">
                                                    {formatCurrency(
                                                        expense.amount,
                                                    )}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {expense.type}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                                <Label className="text-xs text-muted-foreground">
                                                    Paid
                                                </Label>
                                                <input
                                                    type="checkbox"
                                                    checked={expense.paid}
                                                    onChange={() =>
                                                        togglePaid(
                                                            expense.id,
                                                            expense.paid,
                                                        )
                                                    }
                                                    className="w-5 h-5 rounded border-gray-300 cursor-pointer"
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

                <TabsContent value="analytics" className="space-y-6">
                    {expenses.length === 0 ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Analytics</CardTitle>
                                <CardDescription>
                                    No data available
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    Add some expenses to see analytics
                                    visualizations
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Analytics Filters */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Analytics Filters</CardTitle>
                                    <CardDescription>
                                        Filter data by month to see monthly
                                        performance
                                    </CardDescription>
                                    <CardTitle>Filters</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col gap-4">
                                        <div>
                                            <Label className="block mb-2">
                                                Year
                                            </Label>
                                            <Select
                                                value={selectedYear}
                                                onValueChange={(value) => {
                                                    setSelectedYear(value);
                                                    setSelectedMonth("all");
                                                }}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="All Years" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">
                                                        All Years
                                                    </SelectItem>
                                                    {availableYears.map(
                                                        (year) => (
                                                            <SelectItem
                                                                key={year}
                                                                value={year}
                                                            >
                                                                {year}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label className="block mb-2">
                                                Month
                                            </Label>
                                            <Select
                                                value={selectedMonth}
                                                onValueChange={setSelectedMonth}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="All Months" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">
                                                        All Months
                                                    </SelectItem>
                                                    {filteredAvailableMonths.map(
                                                        (month) => (
                                                            <SelectItem
                                                                key={month}
                                                                value={month}
                                                            >
                                                                {getMonthLabel(
                                                                    month,
                                                                )}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label className="block mb-2">
                                                Category
                                            </Label>
                                            <Select
                                                value={selectedCategory}
                                                onValueChange={
                                                    setSelectedCategory
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="All Categories" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">
                                                        All Categories
                                                    </SelectItem>
                                                    {categories.map((cat) => (
                                                        <SelectItem
                                                            key={cat.id}
                                                            value={cat.id}
                                                        >
                                                            {cat.icon}{" "}
                                                            {cat.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {(selectedMonth !== "all" ||
                                            selectedYear !== "all" ||
                                            selectedCategory !== "all") && (
                                            <div className="flex items-end">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSelectedYear("all");
                                                        setSelectedMonth("all");
                                                        setSelectedCategory(
                                                            "all",
                                                        );
                                                    }}
                                                >
                                                    Clear Filters
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <SummaryCards
                                incomes={incomes.filter((inc) => {
                                    const incomeMonthKey = getMonthKey(
                                        inc.date,
                                    );
                                    const [incomeYear] =
                                        incomeMonthKey.split("-");

                                    const yearMatch =
                                        selectedYear === "all" ||
                                        incomeYear === selectedYear;
                                    const monthMatch =
                                        selectedMonth === "all" ||
                                        incomeMonthKey === selectedMonth;

                                    return yearMatch && monthMatch;
                                })}
                                expenses={filteredExpenses}
                                users={activeUsers}
                            />
                            <CategoryPieCharts
                                categoryTotals={stats.categoryTotals}
                                formatCurrency={formatCurrency}
                                userTotals={stats.userTotals}
                                users={activeUsers}
                            />
                            <MonthlyOverviewChart
                                expenses={expenses}
                                users={activeUsers}
                            />
                            <SpendingTrendChart
                                expenses={expenses}
                                users={activeUsers}
                            />
                            <CategoryComparisonChart
                                categoryTotals={stats.categoryTotals}
                                formatCurrency={formatCurrency}
                                users={activeUsers}
                            />
                            <ExpenseTypeCards
                                expenses={expenses}
                                users={activeUsers}
                            />
                        </>
                    )}
                </TabsContent>

                <TabsContent value="budget" className="space-y-6">
                    {/* Budget Month Selector */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Select Budget Month</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4">
                                <div>
                                    <Label className="block mb-2">Year</Label>
                                    <Select
                                        value={budgetYear}
                                        onValueChange={setBudgetYear}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableYears.map((year) => (
                                                <SelectItem
                                                    key={year}
                                                    value={year}
                                                >
                                                    {year}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="block mb-2">Month</Label>
                                    <Select
                                        value={budgetMonthNum}
                                        onValueChange={setBudgetMonthNum}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Month" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {monthNames.map((name, idx) => (
                                                <SelectItem
                                                    key={idx}
                                                    value={String(
                                                        idx + 1,
                                                    ).padStart(2, "0")}
                                                >
                                                    {name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Income Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Income for {getMonthLabel(budgetMonth)}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-2">
                                                Type
                                            </th>
                                            {activeUsers.map((user) => (
                                                <th
                                                    key={user.id}
                                                    className="text-left p-2"
                                                >
                                                    {user.name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {incomeTypes.map((type) => (
                                            <tr key={type} className="border-b">
                                                <td className="p-2 font-medium">
                                                    {type}
                                                </td>
                                                {activeUsers.map((user) => (
                                                    <td
                                                        key={user.id}
                                                        className="p-2"
                                                    >
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={
                                                                editingIncome[
                                                                    `${user.id}-${type}`
                                                                ] ??
                                                                getIncomeAmount(
                                                                    user.id,
                                                                    type,
                                                                )
                                                            }
                                                            onChange={(e) => {
                                                                setEditingIncome(
                                                                    {
                                                                        ...editingIncome,
                                                                        [`${user.id}-${type}`]:
                                                                            e
                                                                                .target
                                                                                .value,
                                                                    },
                                                                );
                                                            }}
                                                            onBlur={(e) => {
                                                                updateIncome(
                                                                    user.id,
                                                                    type,
                                                                    e.target
                                                                        .value,
                                                                );
                                                                const newEditing =
                                                                    {
                                                                        ...editingIncome,
                                                                    };
                                                                delete newEditing[
                                                                    `${user.id}-${type}`
                                                                ];
                                                                setEditingIncome(
                                                                    newEditing,
                                                                );
                                                            }}
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                        <tr className="font-bold">
                                            <td className="p-2">Total</td>
                                            {activeUsers.map((user) => {
                                                const total =
                                                    incomeTypes.reduce(
                                                        (sum, type) =>
                                                            sum +
                                                            getIncomeAmount(
                                                                user.id,
                                                                type,
                                                            ),
                                                        0,
                                                    );
                                                return (
                                                    <td
                                                        key={user.id}
                                                        className="p-2"
                                                    >
                                                        {formatCurrency(total)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Budget Summary */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Budget Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {activeUsers.map((user) => {
                                    const income = incomeTypes.reduce(
                                        (sum, type) =>
                                            sum +
                                            getIncomeAmount(user.id, type),
                                        0,
                                    );
                                    const expenses =
                                        stats.userBudgetTotals[user.id] || 0;
                                    const savings = income - expenses;
                                    const savingsRate =
                                        income > 0
                                            ? (savings / income) * 100
                                            : 0;

                                    return (
                                        <div
                                            key={user.id}
                                            className="p-4 border rounded-lg"
                                        >
                                            <h3 className="font-semibold mb-3">
                                                {user.name}
                                            </h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Income
                                                    </p>
                                                    <p className="text-lg font-semibold text-green-600">
                                                        {formatCurrency(income)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Expenses
                                                    </p>
                                                    <p className="text-lg font-semibold text-red-600">
                                                        {formatCurrency(
                                                            expenses,
                                                        )}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Savings
                                                    </p>
                                                    <p
                                                        className={`text-lg font-semibold ${savings >= 0 ? "text-green-600" : "text-red-600"}`}
                                                    >
                                                        {formatCurrency(
                                                            savings,
                                                        )}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Savings Rate
                                                    </p>
                                                    <p
                                                        className={`text-lg font-semibold ${savingsRate >= 20 ? "text-green-600" : "text-orange-600"}`}
                                                    >
                                                        {savingsRate.toFixed(1)}
                                                        %
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
