"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAccountingMode } from "@/hooks/use-accounting-mode";
import { AccountingModeIndicator } from "@/components/AccountingModeIndicator";
import { SharedPoolSummary } from "@/components/shared-pool/SharedPoolSummary";
import { PoolExpenseCard } from "@/components/expenses/PoolExpenseCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Loader2, ArrowLeft, Settings, Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

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
    isActive?: boolean;
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
    paidFromPool: boolean;
    needsReimbursement: boolean;
}

interface Reimbursement {
    id: string;
    userId: string;
    userName: string;
    month: string;
    amount: number;
    description: string;
    settled: boolean;
    createdAt: string;
    settledAt?: string;
    user: User;
}

export default function SharedPoolExpensesPage() {
    const router = useRouter();
    const {
        accountingMode,
        loading: modeLoading,
        getExpenseEndpoint,
    } = useAccountingMode();

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>("all");
    const [selectedYear, setSelectedYear] = useState<string>(
        new Date().getFullYear().toString(),
    );
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [paidFromPool, setPaidFromPool] = useState(false);
    const [poolRefreshKey, setPoolRefreshKey] = useState<number>(0);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        description: "",
        categoryId: "",
        amount: "0",
        paidById: "",
        type: "shared",
    });

    // Redirect if wrong mode
    useEffect(() => {
        if (!modeLoading && accountingMode !== "shared_pool") {
            router.replace("/expenses/individual");
        }
    }, [accountingMode, modeLoading, router]);

    useEffect(() => {
        if (accountingMode === "shared_pool") {
            fetchExpenses();
            fetchCategories();
            fetchUsers();
            fetchReimbursements();
        }
    }, [accountingMode]);

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

    const fetchReimbursements = async () => {
        try {
            const response = await fetch("/api/reimbursements");
            const data = await response.json();
            if (data.success) {
                setReimbursements(data.reimbursements || []);
            }
        } catch (error) {
            console.error("Error fetching reimbursements:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const amount = parseFloat(formData.amount);

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
                paidFromPool: paidFromPool,
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

                // Refresh shared pool summary
                setPoolRefreshKey((prev) => prev + 1);

                if (data.warning) {
                    toast({
                        title: "Warning",
                        description: data.warning,
                        type: "warning",
                    });
                } else {
                    toast({
                        title: "Success",
                        description: "Expense added successfully",
                    });
                }

                const activeUser = users.find((u) => u.isActive);
                setFormData({
                    date: new Date().toISOString().split("T")[0],
                    description: "",
                    categoryId: "",
                    amount: "0",
                    paidById: activeUser?.id || "",
                    type: "shared",
                });
                setPaidFromPool(false);
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

    // Calculate stats for shared pool
    const calculateStats = () => {
        const poolSpent = filteredExpenses
            .filter((e) => e.type === "shared" && e.paidFromPool)
            .reduce((sum, e) => sum + e.amount, 0);

        const reimbursementsSettled = reimbursements
            .filter((r) => r.settled)
            .reduce((sum, r) => sum + r.amount, 0);

        const totalPoolSpent = poolSpent + reimbursementsSettled;

        const userPersonalSpending: { [userId: string]: number } = {};
        activeUsers.forEach((user) => {
            userPersonalSpending[user.id] = filteredExpenses
                .filter((e) => e.type === "personal" && e.paidBy.id === user.id)
                .reduce((sum, e) => sum + e.amount, 0);
        });

        return {
            totalPoolSpent,
            poolSpent,
            reimbursementsSettled,
            userPersonalSpending,
        };
    };

    const stats = calculateStats();

    if (modeLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (accountingMode !== "shared_pool") {
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
                            Shared Pool Expenses
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Manage expenses from the shared pool with personal
                            allowances
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Link href="/reimbursements">
                        <Button variant="outline">
                            <Receipt className="mr-2 h-4 w-4" />
                            Reimbursements
                        </Button>
                    </Link>
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
                                    Create a new expense for the shared pool
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
                                    <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                                        <input
                                            type="checkbox"
                                            id="paidFromPool"
                                            checked={paidFromPool}
                                            onChange={(e) =>
                                                setPaidFromPool(
                                                    e.target.checked,
                                                )
                                            }
                                            className="w-4 h-4 rounded border-gray-300"
                                        />
                                        <Label
                                            htmlFor="paidFromPool"
                                            className="text-sm font-normal cursor-pointer"
                                        >
                                            Paid from shared pool (if unchecked,
                                            will create a reimbursement request)
                                        </Label>
                                    </div>
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
                    <SharedPoolSummary key={poolRefreshKey} />

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Pool Spent (Filtered)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">
                                    {formatCurrency(stats.totalPoolSpent)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    In selected period
                                </p>
                            </CardContent>
                        </Card>

                        {activeUsers.map((user) => (
                            <Card key={user.id}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        {user.name} Personal
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">
                                        {formatCurrency(
                                            stats.userPersonalSpending[
                                                user.id
                                            ] || 0,
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Personal spending in period
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
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
                                    <PoolExpenseCard
                                        key={expense.id}
                                        expense={expense}
                                    />
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
