"use client";

import { useEffect, useState } from "react";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Category {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
}

interface User {
    id: string;
    name: string;
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

interface MonthlyIncome {
    [key: string]: {
        andre: { [type: string]: number };
        rita: { [type: string]: number };
    };
}

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>("all");
    const [budgetYear, setBudgetYear] = useState<string>("");
    const [budgetMonthNum, setBudgetMonthNum] = useState<string>("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        description: "",
        categoryId: "",
        amount: "",
        paidById: "andre",
        type: "shared",
        splitType: "equal",
        andreAmount: "",
        ritaAmount: "",
    });

    const [editingIncome, setEditingIncome] = useState<{
        [key: string]: string;
    }>({});

    const incomeTypes = ["Salario", "Beneficios", "Extras"];

    useEffect(() => {
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
        let splits = [];

        if (formData.splitType === "equal") {
            const splitAmount = amount / 2;
            splits = [
                { userId: "andre", amount: splitAmount, paid: false },
                { userId: "rita", amount: splitAmount, paid: false },
            ];
        } else {
            splits = [
                {
                    userId: "andre",
                    amount: parseFloat(formData.andreAmount),
                    paid: false,
                },
                {
                    userId: "rita",
                    amount: parseFloat(formData.ritaAmount),
                    paid: false,
                },
            ];
        }

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
                setFormData({
                    date: new Date().toISOString().split("T")[0],
                    description: "",
                    categoryId: "",
                    amount: "",
                    paidById: "andre",
                    type: "shared",
                    splitType: "equal",
                    andreAmount: "",
                    ritaAmount: "",
                });
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

        // Find existing MANUAL income entry for this month, user, and type (not from transactions)
        const monthStart = new Date(budgetMonth + "-01");
        const existingIncome = incomes.find(
            (inc) =>
                inc.userId === userId &&
                inc.type === type &&
                new Date(inc.date).getMonth() === monthStart.getMonth() &&
                new Date(inc.date).getFullYear() === monthStart.getFullYear() &&
                !inc.transactions?.length, // Only manual entries (not linked to transactions)
        );

        try {
            if (existingIncome) {
                if (numAmount === 0) {
                    // Delete if amount is 0
                    await fetch(`/api/income?id=${existingIncome.id}`, {
                        method: "DELETE",
                    });
                } else {
                    // Update existing
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
                // Create new
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
        // Sum all income for this user/type/month (from both transactions and manual entries)
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
        const monthMatch =
            selectedMonth === "all" || getMonthKey(exp.date) === selectedMonth;
        const categoryMatch =
            selectedCategory === "all" || exp.category.id === selectedCategory;
        return monthMatch && categoryMatch;
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

    const calculateStats = () => {
        // For budget tab, use budgetMonth; otherwise use all filtered expenses
        const expensesForStats = filteredExpenses;

        // Filter expenses by budget month for budget calculations
        const budgetMonthExpenses =
            budgetMonth !== "all"
                ? expenses.filter(
                      (exp) => getMonthKey(exp.date) === budgetMonth,
                  )
                : expenses;

        // Total spending (all expenses - for tracking)
        const andreTotal = expensesForStats.reduce((sum, exp) => {
            const andreSplit = exp.splits.find((s) => s.userId === "andre");
            return sum + (andreSplit?.amount || 0);
        }, 0);

        const ritaTotal = expensesForStats.reduce((sum, exp) => {
            const ritaSplit = exp.splits.find((s) => s.userId === "rita");
            return sum + (ritaSplit?.amount || 0);
        }, 0);

        const total = andreTotal + ritaTotal;

        // Budget month totals (for Budget tab)
        const andreBudgetTotal = budgetMonthExpenses.reduce((sum, exp) => {
            const andreSplit = exp.splits.find((s) => s.userId === "andre");
            return sum + (andreSplit?.amount || 0);
        }, 0);

        const ritaBudgetTotal = budgetMonthExpenses.reduce((sum, exp) => {
            const ritaSplit = exp.splits.find((s) => s.userId === "rita");
            return sum + (ritaSplit?.amount || 0);
        }, 0);

        // Balance calculation (only unpaid shared expenses)
        // For shared expenses: person who didn't pay owes their share to person who did pay
        const unpaidSharedExpenses = filteredExpenses.filter(
            (exp) => !exp.paid && exp.type === "shared",
        );

        // Calculate what each person paid vs what they owe
        let andreBalance = 0;
        let ritaBalance = 0;

        unpaidSharedExpenses.forEach((exp) => {
            const andreSplit = exp.splits.find((s) => s.userId === "andre");
            const ritaSplit = exp.splits.find((s) => s.userId === "rita");
            const andreShare = andreSplit?.amount || 0;
            const ritaShare = ritaSplit?.amount || 0;

            if (exp.paidById === "andre") {
                // Andre paid, so he's owed Rita's share
                andreBalance += ritaShare;
            } else if (exp.paidById === "rita") {
                // Rita paid, so she's owed Andre's share
                ritaBalance += andreShare;
            }
        });

        // Net balance: who owes who
        const andreOwes = Math.max(0, ritaBalance - andreBalance);
        const ritaOwes = Math.max(0, andreBalance - ritaBalance);

        const categoryTotals: {
            [key: string]: { andre: number; rita: number };
        } = {};

        filteredExpenses.forEach((exp) => {
            if (!categoryTotals[exp.category.name]) {
                categoryTotals[exp.category.name] = { andre: 0, rita: 0 };
            }
            const andreSplit = exp.splits.find((s) => s.userId === "andre");
            const ritaSplit = exp.splits.find((s) => s.userId === "rita");

            categoryTotals[exp.category.name].andre += andreSplit?.amount || 0;
            categoryTotals[exp.category.name].rita += ritaSplit?.amount || 0;
        });

        const monthTotals: {
            [monthKey: string]: {
                andre: number;
                rita: number;
                byCategory: {
                    [categoryName: string]: { andre: number; rita: number };
                };
            };
        } = {};

        filteredExpenses.forEach((exp) => {
            const monthKey = getMonthKey(exp.date);
            if (!monthTotals[monthKey]) {
                monthTotals[monthKey] = { andre: 0, rita: 0, byCategory: {} };
            }

            const andreSplit = exp.splits.find((s) => s.userId === "andre");
            const ritaSplit = exp.splits.find((s) => s.userId === "rita");

            monthTotals[monthKey].andre += andreSplit?.amount || 0;
            monthTotals[monthKey].rita += ritaSplit?.amount || 0;

            if (!monthTotals[monthKey].byCategory[exp.category.name]) {
                monthTotals[monthKey].byCategory[exp.category.name] = {
                    andre: 0,
                    rita: 0,
                };
            }

            monthTotals[monthKey].byCategory[exp.category.name].andre +=
                andreSplit?.amount || 0;
            monthTotals[monthKey].byCategory[exp.category.name].rita +=
                ritaSplit?.amount || 0;
        });

        return {
            andreTotal,
            ritaTotal,
            total,
            andreOwes,
            ritaOwes,
            andreBudgetTotal,
            ritaBudgetTotal,
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
                            Track shared expenses with Rita
                        </p>
                    </div>
                </div>

                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Expense
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Expense</DialogTitle>
                            <DialogDescription>
                                Create a new shared expense
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            date: e.target.value,
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            description: e.target.value,
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium">
                                    Category
                                </label>
                                <select
                                    value={formData.categoryId}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            categoryId: e.target.value,
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                    required
                                >
                                    <option value="">Select category</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.icon} {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium">
                                    Amount
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            amount: e.target.value,
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium">
                                    Paid By
                                </label>
                                <select
                                    value={formData.paidById}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            paidById: e.target.value,
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="andre">Andre Ribeiro</option>
                                    <option value="rita">Rita Pereira</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium">
                                    Type
                                </label>
                                <select
                                    value={formData.type}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            type: e.target.value,
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="shared">Partilhado</option>
                                    <option value="personal">Pessoal</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium">
                                    Split Type
                                </label>
                                <select
                                    value={formData.splitType}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            splitType: e.target.value,
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="equal">Equal Split</option>
                                    <option value="custom">Custom Split</option>
                                </select>
                            </div>

                            {formData.splitType === "custom" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium">
                                            Andre Amount
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.andreAmount}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    andreAmount: e.target.value,
                                                })
                                            }
                                            className="w-full p-2 border rounded"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">
                                            Rita Amount
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.ritaAmount}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    ritaAmount: e.target.value,
                                                })
                                            }
                                            className="w-full p-2 border rounded"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            <Button type="submit" className="w-full">
                                Add Expense
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="mb-6 flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium mb-2 block">
                        Filter by Month
                    </label>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full p-2 border rounded-md bg-background"
                    >
                        <option value="all">All Months</option>
                        {availableMonths.map((month) => (
                            <option key={month} value={month}>
                                {getMonthLabel(month)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium mb-2 block">
                        Filter by Category
                    </label>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full p-2 border rounded-md bg-background"
                    >
                        <option value="all">All Categories</option>
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <Tabs defaultValue="transactions" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="budget">Budget</TabsTrigger>
                    <TabsTrigger value="categories">By Category</TabsTrigger>
                    <TabsTrigger value="monthly">By Month</TabsTrigger>
                </TabsList>

                <TabsContent value="transactions" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3 mb-6">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium">
                                    Andre Total
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">
                                    {formatCurrency(stats.andreTotal)}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium">
                                    Rita Total
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">
                                    {formatCurrency(stats.ritaTotal)}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium">
                                    Total Geral
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">
                                    {formatCurrency(stats.total)}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>All Expenses</CardTitle>
                            <CardDescription>
                                {filteredExpenses.length} expenses tracked
                                {(selectedMonth !== "all" ||
                                    selectedCategory !== "all") &&
                                    ` (filtered from ${expenses.length} total)`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {filteredExpenses.map((expense) => (
                                    <div
                                        key={expense.id}
                                        className={`flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border ${
                                            expense.paid
                                                ? "bg-green-50 border-green-200"
                                                : "bg-yellow-50 border-yellow-200"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="text-2xl">
                                                {expense.category.icon}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium">
                                                        {expense.description}
                                                    </p>
                                                    <span className="text-xs px-2 py-0.5 rounded bg-muted">
                                                        {expense.category.name}
                                                    </span>
                                                    <span
                                                        className={`text-xs px-2 py-0.5 rounded ${
                                                            expense.type ===
                                                            "shared"
                                                                ? "bg-blue-100 text-blue-700 border border-blue-300"
                                                                : "bg-purple-100 text-purple-700 border border-purple-300"
                                                        }`}
                                                    >
                                                        {expense.type ===
                                                        "shared"
                                                            ? "Partilhado"
                                                            : "Pessoal"}
                                                    </span>
                                                    {expense.paid ? (
                                                        <span className="text-xs px-2 py-0.5 rounded bg-green-600 text-white">
                                                            Paid ✓
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs px-2 py-0.5 rounded bg-yellow-600 text-white">
                                                            Unpaid
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {formatDate(expense.date)} •
                                                    Paid by{" "}
                                                    {expense.paidBy.name}
                                                </p>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {expense.splits.map(
                                                        (split) => (
                                                            <span
                                                                key={split.id}
                                                                className="mr-3"
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
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="font-semibold">
                                                    {formatCurrency(
                                                        expense.amount,
                                                    )}
                                                </p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={expense.paid}
                                                onChange={() =>
                                                    togglePaid(
                                                        expense.id,
                                                        expense.paid,
                                                    )
                                                }
                                                className="w-5 h-5 cursor-pointer"
                                                title={
                                                    expense.paid
                                                        ? "Mark as unpaid"
                                                        : "Mark as paid"
                                                }
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="summary" className="space-y-4">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ratio</CardTitle>
                                <CardDescription>
                                    Spending distribution
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-sm font-medium">
                                                Andre Ribeiro
                                            </span>
                                            <span className="text-sm">
                                                {(
                                                    (stats.andreTotal /
                                                        stats.total) *
                                                    100
                                                ).toFixed(0)}
                                                %
                                            </span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2">
                                            <div
                                                className="bg-blue-500 h-2 rounded-full"
                                                style={{
                                                    width: `${(stats.andreTotal / stats.total) * 100}%`,
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-sm font-medium">
                                                Rita Pereira
                                            </span>
                                            <span className="text-sm">
                                                {(
                                                    (stats.ritaTotal /
                                                        stats.total) *
                                                    100
                                                ).toFixed(0)}
                                                %
                                            </span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2">
                                            <div
                                                className="bg-pink-500 h-2 rounded-full"
                                                style={{
                                                    width: `${(stats.ritaTotal / stats.total) * 100}%`,
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Balance</CardTitle>
                                <CardDescription>
                                    Outstanding debts (unpaid shared expenses
                                    only)
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <Separator />
                                    {stats.andreOwes === 0 &&
                                    stats.ritaOwes === 0 ? (
                                        <div className="text-center py-4 bg-green-50 rounded-lg border border-green-200">
                                            <p className="text-lg font-semibold text-green-700">
                                                All settled! ✅
                                            </p>
                                            <p className="text-sm text-green-600 mt-1">
                                                No outstanding debts
                                            </p>
                                        </div>
                                    ) : stats.ritaOwes > 0 ? (
                                        <div className="text-center py-4 bg-muted/50 rounded-lg">
                                            <p className="text-sm text-muted-foreground mb-2">
                                                Rita owes Andre
                                            </p>
                                            <p className="text-3xl font-bold text-primary">
                                                {formatCurrency(stats.ritaOwes)}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-2">
                                                From unpaid shared expenses
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 bg-muted/50 rounded-lg">
                                            <p className="text-sm text-muted-foreground mb-2">
                                                Andre owes Rita
                                            </p>
                                            <p className="text-3xl font-bold text-primary">
                                                {formatCurrency(
                                                    stats.andreOwes,
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-2">
                                                From unpaid shared expenses
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="budget" className="space-y-6">
                    {budgetMonth ? (
                        <>
                            <div className="flex items-center gap-4 mb-6">
                                <label className="text-sm font-semibold">
                                    Year:
                                </label>
                                <select
                                    value={budgetYear}
                                    onChange={(e) =>
                                        setBudgetYear(e.target.value)
                                    }
                                    className="p-2 border rounded-md text-lg font-medium"
                                >
                                    {availableYears.map((year) => (
                                        <option key={year} value={year}>
                                            {year}
                                        </option>
                                    ))}
                                </select>

                                <label className="text-sm font-semibold">
                                    Month:
                                </label>
                                <select
                                    value={budgetMonthNum}
                                    onChange={(e) =>
                                        setBudgetMonthNum(e.target.value)
                                    }
                                    className="p-2 border rounded-md text-lg font-medium"
                                >
                                    {monthNames.map((name, idx) => (
                                        <option
                                            key={idx + 1}
                                            value={String(idx + 1).padStart(
                                                2,
                                                "0",
                                            )}
                                        >
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Rita's Budget */}
                                <Card className="overflow-hidden p-0">
                                    <CardHeader className="bg-pink-50 pb-6 px-6 pt-6">
                                        <CardTitle className="text-pink-900 text-xl">
                                            Rita Pereira
                                        </CardTitle>
                                        <CardDescription className="text-base">
                                            Monthly budget for{" "}
                                            {getMonthLabel(budgetMonth)}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-6 px-6 pb-6">
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="font-semibold text-sm text-gray-600 mb-3">
                                                    💰 Income
                                                </h4>
                                                {incomeTypes.map((type) => {
                                                    const amount =
                                                        getIncomeAmount(
                                                            "rita",
                                                            type,
                                                        );
                                                    if (amount === 0)
                                                        return null;
                                                    return (
                                                        <div
                                                            key={type}
                                                            className="flex justify-between items-center py-2 border-b"
                                                        >
                                                            <span className="text-sm">
                                                                {type}
                                                            </span>
                                                            <span className="font-semibold">
                                                                {formatCurrency(
                                                                    amount,
                                                                )}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                                {incomeTypes.every(
                                                    (type) =>
                                                        getIncomeAmount(
                                                            "rita",
                                                            type,
                                                        ) === 0,
                                                ) && (
                                                    <p className="text-sm text-gray-500 italic py-2">
                                                        No tracked income. Track
                                                        deposits on Transactions
                                                        tab.
                                                    </p>
                                                )}
                                                <div className="flex justify-between items-center py-3 font-bold text-green-700 bg-green-50 px-2 rounded mt-2">
                                                    <span>Total Income</span>
                                                    <span>
                                                        {formatCurrency(
                                                            incomeTypes.reduce(
                                                                (sum, type) =>
                                                                    sum +
                                                                    getIncomeAmount(
                                                                        "rita",
                                                                        type,
                                                                    ),
                                                                0,
                                                            ),
                                                        )}
                                                    </span>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="font-semibold text-sm text-gray-600 mb-3">
                                                    💸 Expenses
                                                </h4>
                                                <div className="flex justify-between items-center py-3 font-bold text-red-700 bg-red-50 px-2 rounded">
                                                    <span>Total Expenses</span>
                                                    <span>
                                                        {formatCurrency(
                                                            stats.ritaBudgetTotal,
                                                        )}
                                                    </span>
                                                </div>
                                            </div>

                                            <div
                                                className={`p-4 rounded-lg text-center ${
                                                    incomeTypes.reduce(
                                                        (sum, type) =>
                                                            sum +
                                                            getIncomeAmount(
                                                                "rita",
                                                                type,
                                                            ),
                                                        0,
                                                    ) -
                                                        stats.ritaBudgetTotal >=
                                                    0
                                                        ? "bg-green-100 border-2 border-green-300"
                                                        : "bg-red-100 border-2 border-red-300"
                                                }`}
                                            >
                                                <p className="text-sm font-medium text-gray-600 mb-1">
                                                    {incomeTypes.reduce(
                                                        (sum, type) =>
                                                            sum +
                                                            getIncomeAmount(
                                                                "rita",
                                                                type,
                                                            ),
                                                        0,
                                                    ) -
                                                        stats.ritaBudgetTotal >=
                                                    0
                                                        ? "💚 Saved"
                                                        : "⚠️ Over Budget"}
                                                </p>
                                                <p
                                                    className={`text-3xl font-bold ${
                                                        incomeTypes.reduce(
                                                            (sum, type) =>
                                                                sum +
                                                                getIncomeAmount(
                                                                    "rita",
                                                                    type,
                                                                ),
                                                            0,
                                                        ) -
                                                            stats.ritaBudgetTotal >=
                                                        0
                                                            ? "text-green-900"
                                                            : "text-red-900"
                                                    }`}
                                                >
                                                    {formatCurrency(
                                                        incomeTypes.reduce(
                                                            (sum, type) =>
                                                                sum +
                                                                getIncomeAmount(
                                                                    "rita",
                                                                    type,
                                                                ),
                                                            0,
                                                        ) -
                                                            stats.ritaBudgetTotal,
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* André's Budget */}
                                <Card className="overflow-hidden p-0">
                                    <CardHeader className="bg-blue-50 pb-6 px-6 pt-6">
                                        <CardTitle className="text-blue-900 text-xl">
                                            André Ribeiro
                                        </CardTitle>
                                        <CardDescription className="text-base">
                                            Monthly budget for{" "}
                                            {getMonthLabel(budgetMonth)}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-6 px-6 pb-6">
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="font-semibold text-sm text-gray-600 mb-3">
                                                    💰 Income
                                                </h4>
                                                {incomeTypes.map((type) => {
                                                    const amount =
                                                        getIncomeAmount(
                                                            "andre",
                                                            type,
                                                        );
                                                    if (amount === 0)
                                                        return null;
                                                    return (
                                                        <div
                                                            key={type}
                                                            className="flex justify-between items-center py-2 border-b"
                                                        >
                                                            <span className="text-sm">
                                                                {type}
                                                            </span>
                                                            <span className="font-semibold">
                                                                {formatCurrency(
                                                                    amount,
                                                                )}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                                {incomeTypes.every(
                                                    (type) =>
                                                        getIncomeAmount(
                                                            "andre",
                                                            type,
                                                        ) === 0,
                                                ) && (
                                                    <p className="text-sm text-gray-500 italic py-2">
                                                        No tracked income. Track
                                                        deposits on Transactions
                                                        tab.
                                                    </p>
                                                )}
                                                <div className="flex justify-between items-center py-3 font-bold text-green-700 bg-green-50 px-2 rounded mt-2">
                                                    <span>Total Income</span>
                                                    <span>
                                                        {formatCurrency(
                                                            incomeTypes.reduce(
                                                                (sum, type) =>
                                                                    sum +
                                                                    getIncomeAmount(
                                                                        "andre",
                                                                        type,
                                                                    ),
                                                                0,
                                                            ),
                                                        )}
                                                    </span>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="font-semibold text-sm text-gray-600 mb-3">
                                                    💸 Expenses
                                                </h4>
                                                <div className="flex justify-between items-center py-3 font-bold text-red-700 bg-red-50 px-2 rounded">
                                                    <span>Total Expenses</span>
                                                    <span>
                                                        {formatCurrency(
                                                            stats.andreBudgetTotal,
                                                        )}
                                                    </span>
                                                </div>
                                            </div>

                                            <div
                                                className={`p-4 rounded-lg text-center ${
                                                    incomeTypes.reduce(
                                                        (sum, type) =>
                                                            sum +
                                                            getIncomeAmount(
                                                                "andre",
                                                                type,
                                                            ),
                                                        0,
                                                    ) -
                                                        stats.andreBudgetTotal >=
                                                    0
                                                        ? "bg-green-100 border-2 border-green-300"
                                                        : "bg-red-100 border-2 border-red-300"
                                                }`}
                                            >
                                                <p className="text-sm font-medium text-gray-600 mb-1">
                                                    {incomeTypes.reduce(
                                                        (sum, type) =>
                                                            sum +
                                                            getIncomeAmount(
                                                                "andre",
                                                                type,
                                                            ),
                                                        0,
                                                    ) -
                                                        stats.andreBudgetTotal >=
                                                    0
                                                        ? "💚 Saved"
                                                        : "⚠️ Over Budget"}
                                                </p>
                                                <p
                                                    className={`text-3xl font-bold ${
                                                        incomeTypes.reduce(
                                                            (sum, type) =>
                                                                sum +
                                                                getIncomeAmount(
                                                                    "andre",
                                                                    type,
                                                                ),
                                                            0,
                                                        ) -
                                                            stats.andreBudgetTotal >=
                                                        0
                                                            ? "text-green-900"
                                                            : "text-red-900"
                                                    }`}
                                                >
                                                    {formatCurrency(
                                                        incomeTypes.reduce(
                                                            (sum, type) =>
                                                                sum +
                                                                getIncomeAmount(
                                                                    "andre",
                                                                    type,
                                                                ),
                                                            0,
                                                        ) -
                                                            stats.andreBudgetTotal,
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="bg-gray-50">
                                <CardContent className="pt-6">
                                    <p className="text-sm text-gray-600 text-center">
                                        💡 <strong>Tip:</strong> Go to
                                        Transactions tab → Click on deposits →
                                        Track as income (Salario, Beneficios, or
                                        Extras)
                                    </p>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <Card>
                            <CardContent className="py-12">
                                <p className="text-center text-gray-500">
                                    No expenses found. Add some expenses to see
                                    budget tracking.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="categories" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gastos Pessoais - By Category</CardTitle>
                            <CardDescription>
                                Breakdown by spending category
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-gray-300">
                                            <th className="text-left p-3 font-semibold bg-gray-50">
                                                Categoria
                                            </th>
                                            <th className="text-right p-3 font-semibold bg-blue-50">
                                                Andre Ribeiro
                                            </th>
                                            <th className="text-right p-3 font-semibold bg-pink-50">
                                                Rita Pereira
                                            </th>
                                            <th className="text-right p-3 font-semibold bg-gray-100">
                                                Total geral
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(stats.categoryTotals)
                                            .sort(
                                                ([, a], [, b]) =>
                                                    b.andre +
                                                    b.rita -
                                                    (a.andre + a.rita),
                                            )
                                            .map(([categoryName, totals]) => {
                                                const total =
                                                    totals.andre + totals.rita;
                                                const category =
                                                    categories.find(
                                                        (c) =>
                                                            c.name ===
                                                            categoryName,
                                                    );
                                                return (
                                                    <tr
                                                        key={categoryName}
                                                        className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                                                    >
                                                        <td className="p-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xl">
                                                                    {
                                                                        category?.icon
                                                                    }
                                                                </span>
                                                                <span className="font-medium">
                                                                    {
                                                                        categoryName
                                                                    }
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="text-right p-3 bg-blue-50/30">
                                                            <span className="font-semibold text-blue-900">
                                                                {formatCurrency(
                                                                    totals.andre,
                                                                )}
                                                            </span>
                                                        </td>
                                                        <td className="text-right p-3 bg-pink-50/30">
                                                            <span className="font-semibold text-pink-900">
                                                                {formatCurrency(
                                                                    totals.rita,
                                                                )}
                                                            </span>
                                                        </td>
                                                        <td className="text-right p-3 bg-gray-100/50">
                                                            <span className="font-bold">
                                                                {formatCurrency(
                                                                    total,
                                                                )}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        <tr className="border-t-2 border-gray-300 font-bold bg-gray-50">
                                            <td className="p-3">Total geral</td>
                                            <td className="text-right p-3 bg-blue-100/50 text-blue-900">
                                                {formatCurrency(
                                                    stats.andreTotal,
                                                )}
                                            </td>
                                            <td className="text-right p-3 bg-pink-100/50 text-pink-900">
                                                {formatCurrency(
                                                    stats.ritaTotal,
                                                )}
                                            </td>
                                            <td className="text-right p-3 bg-gray-200 text-lg">
                                                {formatCurrency(stats.total)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="monthly" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gastos Pessoais - By Month</CardTitle>
                            <CardDescription>
                                Monthly breakdown with category details
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {Object.entries(stats.monthTotals)
                                    .sort(([a], [b]) => b.localeCompare(a))
                                    .map(([monthKey, monthData]) => {
                                        const monthTotal =
                                            monthData.andre + monthData.rita;
                                        return (
                                            <div
                                                key={monthKey}
                                                className="p-4 border rounded-lg space-y-4"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-bold text-lg">
                                                        {getMonthLabel(
                                                            monthKey,
                                                        )}
                                                    </h3>
                                                    <span className="font-bold text-lg">
                                                        {formatCurrency(
                                                            monthTotal,
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded">
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Andre Ribeiro
                                                        </p>
                                                        <p className="font-semibold text-lg">
                                                            {formatCurrency(
                                                                monthData.andre,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Rita Pereira
                                                        </p>
                                                        <p className="font-semibold text-lg">
                                                            {formatCurrency(
                                                                monthData.rita,
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <h4 className="font-semibold text-sm text-muted-foreground">
                                                        Category Breakdown
                                                    </h4>
                                                    {Object.entries(
                                                        monthData.byCategory,
                                                    )
                                                        .sort(
                                                            ([, a], [, b]) =>
                                                                b.andre +
                                                                b.rita -
                                                                (a.andre +
                                                                    a.rita),
                                                        )
                                                        .map(
                                                            ([
                                                                categoryName,
                                                                catTotals,
                                                            ]) => {
                                                                const catTotal =
                                                                    catTotals.andre +
                                                                    catTotals.rita;
                                                                const category =
                                                                    categories.find(
                                                                        (c) =>
                                                                            c.name ===
                                                                            categoryName,
                                                                    );
                                                                return (
                                                                    <div
                                                                        key={
                                                                            categoryName
                                                                        }
                                                                        className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-lg">
                                                                                {
                                                                                    category?.icon
                                                                                }
                                                                            </span>
                                                                            <span className="text-sm font-medium">
                                                                                {
                                                                                    categoryName
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-4 text-sm">
                                                                            <span className="text-muted-foreground">
                                                                                A:{" "}
                                                                                {formatCurrency(
                                                                                    catTotals.andre,
                                                                                )}
                                                                            </span>
                                                                            <span className="text-muted-foreground">
                                                                                R:{" "}
                                                                                {formatCurrency(
                                                                                    catTotals.rita,
                                                                                )}
                                                                            </span>
                                                                            <span className="font-semibold min-w-[80px] text-right">
                                                                                {formatCurrency(
                                                                                    catTotal,
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            },
                                                        )}
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
