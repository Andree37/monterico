"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAccountingMode } from "@/hooks/use-accounting-mode";
import { SharedPoolSummary } from "@/components/shared-pool/SharedPoolSummary";
import { PoolExpenseCard } from "@/components/expenses/PoolExpenseCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContainer, TabIcons } from "@/components/layout/TabsContainer";
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
import { Plus, Loader2, Users, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface PersonalAllowance {
    householdMemberId: string;
    memberName: string;
    allocated: number;
    spent: number;
    remaining: number;
    carriedOver: number;
    carriedTo: number;
}

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

interface HouseholdMember {
    id: string;
    name: string;
}

interface Reimbursement {
    id: string;
    userId: string;
    householdMemberId: string;
    month: string;
    amount: number;
    description: string;
    settled: boolean;
    createdAt: string;
    settledAt?: string;
    householdMember: HouseholdMember;
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
    const [allowances, setAllowances] = useState<PersonalAllowance[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const getCurrentYearMonth = () => {
        const now = new Date();
        return {
            year: now.getFullYear().toString(),
            month: String(now.getMonth() + 1).padStart(2, "0"),
        };
    };
    const { year: currentYear, month: currentMonth } = getCurrentYearMonth();
    const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
    const [selectedYear, setSelectedYear] = useState<string>(currentYear);
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

    const getSelectedMonthKey = () => {
        return `${selectedYear}-${selectedMonth}`;
    };

    const fetchAllowances = useCallback(async () => {
        try {
            const monthKey = getSelectedMonthKey();
            const response = await fetch(`/api/shared-pool?month=${monthKey}`);
            const data = await response.json();
            if (data.memberAllowances) {
                setAllowances(data.memberAllowances);
            }
        } catch (error) {
            console.error("Error fetching allowances:", error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMonth, selectedYear]);

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
            fetchAllowances();
        }
    }, [accountingMode, fetchAllowances]);

    useEffect(() => {
        if (users.length > 0 && !formData.paidById) {
            const activeUser = users.find((u) => u.isActive);
            if (activeUser) {
                setFormData((prev) => ({ ...prev, paidById: activeUser.id }));
            }
        }
    }, [users, formData.paidById]);

    useEffect(() => {
        if (accountingMode === "shared_pool") {
            fetchAllowances();
        }
    }, [selectedMonth, selectedYear, accountingMode, fetchAllowances]);

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

    const formatMonth = (monthStr: string) => {
        const [year, month] = monthStr.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString("en-IE", {
            month: "long",
            year: "numeric",
        });
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
                setPoolRefreshKey((prev) => prev + 1);

                if (data.warning) {
                    toast.warning(data.warning);
                } else {
                    toast.success("Expense added successfully");
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
                toast.error(data.error || "Failed to add expense");
            }
        } catch (error) {
            console.error("Error creating expense:", error);
            toast.error("An unexpected error occurred");
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
        const monthMatch = expenseMonth === selectedMonth;
        const categoryMatch =
            selectedCategory === "all" || exp.category.id === selectedCategory;
        return yearMatch && monthMatch && categoryMatch;
    });

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

    const getFormattedPeriod = () => {
        const monthIndex = parseInt(selectedMonth) - 1;
        return `${monthNames[monthIndex]} ${selectedYear}`;
    };

    const activeUsers = users.filter((u) => u.isActive);

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

    const _stats = calculateStats();

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
            <div className="flex justify-end mb-6">
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
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

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="date">Date</Label>
                                <Input
                                    id="date"
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

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Input
                                    id="description"
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

                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <Select
                                    value={formData.categoryId}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            categoryId: value,
                                        })
                                    }
                                >
                                    <SelectTrigger id="category">
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

                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount (€)</Label>
                                <Input
                                    id="amount"
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

                            <div className="space-y-2">
                                <Label htmlFor="paidBy">Paid By</Label>
                                <Select
                                    value={formData.paidById}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            paidById: value,
                                        })
                                    }
                                >
                                    <SelectTrigger id="paidBy">
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

                            <div className="space-y-2">
                                <Label htmlFor="type">Type</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            type: value,
                                        })
                                    }
                                >
                                    <SelectTrigger id="type">
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
                                            setPaidFromPool(e.target.checked)
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

            <Card className="bg-linear-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader className="pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg">
                                Viewing: {getFormattedPeriod()}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Select a period to view pool data and expenses
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <div>
                                <Label className="block mb-2 text-xs">
                                    Year
                                </Label>
                                <Select
                                    value={selectedYear}
                                    onValueChange={(value) => {
                                        setSelectedYear(value);
                                        const monthsInNewYear = availableMonths
                                            .filter((m) => m.startsWith(value))
                                            .map((m) => m.split("-")[1]);
                                        if (
                                            !monthsInNewYear.includes(
                                                selectedMonth,
                                            )
                                        ) {
                                            setSelectedMonth(
                                                monthsInNewYear[0] ||
                                                    currentMonth,
                                            );
                                        }
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
                                <Label className="block mb-2 text-xs">
                                    Month
                                </Label>
                                <Select
                                    value={selectedMonth}
                                    onValueChange={setSelectedMonth}
                                >
                                    <SelectTrigger className="w-40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableMonthsInYear.map(
                                            (monthNum) => {
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
                                            },
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <TabsContainer
                defaultValue="overview"
                tabs={[
                    {
                        value: "overview",
                        label: "Overview",
                        icon: <TabIcons.Overview className="h-4 w-4" />,
                        content: (
                            <SharedPoolSummary
                                key={`${poolRefreshKey}-${getSelectedMonthKey()}`}
                                month={getSelectedMonthKey()}
                            />
                        ),
                    },
                    {
                        value: "expenses",
                        label: "Expenses",
                        icon: <TabIcons.Expenses className="h-4 w-4" />,
                        content: (
                            <>
                                <div className="flex gap-4 flex-wrap">
                                    <div>
                                        <Label className="block mb-2">
                                            Category
                                        </Label>
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
                            </>
                        ),
                    },
                    {
                        value: "allowances",
                        label: "Allowances",
                        icon: <TabIcons.Wallet className="h-4 w-4" />,
                        content: (
                            <div className="space-y-6">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <div className="flex gap-2 items-start">
                                        <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                        <div className="text-xs text-blue-900">
                                            <p className="font-medium mb-1">
                                                Personal Allowances for{" "}
                                                {formatMonth(
                                                    getSelectedMonthKey(),
                                                )}
                                            </p>
                                            <p>
                                                Personal allowances are
                                                allocated from income. Each
                                                person can spend their allowance
                                                freely. Unused amounts carry
                                                forward to the next month, while
                                                overspending carries as debt.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {allowances.length === 0 ? (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                                        <h3 className="font-semibold text-yellow-900 mb-2">
                                            No Allowances for{" "}
                                            {formatMonth(getSelectedMonthKey())}
                                        </h3>
                                        <p className="text-sm text-yellow-800 mb-2">
                                            No income has been added for this
                                            month yet.
                                        </p>
                                        <p className="text-xs text-yellow-700">
                                            Add income to automatically allocate
                                            personal allowances based on your
                                            settings.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
                                                {formatMonth(
                                                    getSelectedMonthKey(),
                                                )}
                                            </h3>
                                            <div className="flex-1 h-px bg-border"></div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {allowances.map((allowance) => (
                                                <Card
                                                    key={
                                                        allowance.householdMemberId
                                                    }
                                                    className={
                                                        allowance.remaining < 0
                                                            ? "border-2 border-red-200 bg-red-50/30"
                                                            : ""
                                                    }
                                                >
                                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                        <CardTitle className="text-sm font-medium">
                                                            {
                                                                allowance.memberName
                                                            }
                                                        </CardTitle>
                                                        <Users className="h-4 w-4 text-muted-foreground" />
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="space-y-3">
                                                            <div>
                                                                <div className="text-2xl font-bold">
                                                                    {formatCurrency(
                                                                        allowance.remaining,
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Available
                                                                    balance
                                                                </p>
                                                            </div>

                                                            {allowance.carriedOver !==
                                                                0 && (
                                                                <div className="text-xs">
                                                                    <span
                                                                        className={
                                                                            allowance.carriedOver >
                                                                            0
                                                                                ? "text-green-600 font-medium"
                                                                                : "text-red-600 font-medium"
                                                                        }
                                                                    >
                                                                        {allowance.carriedOver >
                                                                        0
                                                                            ? "+"
                                                                            : ""}
                                                                        {formatCurrency(
                                                                            allowance.carriedOver,
                                                                        )}{" "}
                                                                        carried
                                                                        from
                                                                        last
                                                                        month
                                                                    </span>
                                                                </div>
                                                            )}

                                                            <div className="space-y-1">
                                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                                    <span>
                                                                        Allocated:{" "}
                                                                        {formatCurrency(
                                                                            allowance.allocated,
                                                                        )}
                                                                    </span>
                                                                    <span>
                                                                        Spent:{" "}
                                                                        {formatCurrency(
                                                                            allowance.spent,
                                                                        )}
                                                                    </span>
                                                                </div>

                                                                <div className="w-full bg-muted rounded-full h-2">
                                                                    <div
                                                                        className={`h-2 rounded-full transition-all ${
                                                                            allowance.remaining <
                                                                            0
                                                                                ? "bg-red-500"
                                                                                : allowance.remaining /
                                                                                        allowance.allocated <
                                                                                    0.2
                                                                                  ? "bg-orange-500"
                                                                                  : "bg-green-500"
                                                                        }`}
                                                                        style={{
                                                                            width: `${Math.min(
                                                                                100,
                                                                                Math.max(
                                                                                    0,
                                                                                    ((allowance.allocated -
                                                                                        allowance.spent) /
                                                                                        allowance.allocated) *
                                                                                        100,
                                                                                ),
                                                                            )}%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>

                                                            {allowance.remaining <
                                                                0 && (
                                                                <div className="bg-red-100 border border-red-200 rounded-md p-2">
                                                                    <p className="text-xs text-red-700 font-medium">
                                                                        ⚠️
                                                                        Overspent
                                                                        by{" "}
                                                                        {formatCurrency(
                                                                            Math.abs(
                                                                                allowance.remaining,
                                                                            ),
                                                                        )}
                                                                    </p>
                                                                    <p className="text-xs text-red-600 mt-1">
                                                                        This
                                                                        deficit
                                                                        will be
                                                                        carried
                                                                        to next
                                                                        month
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {allowance.remaining >
                                                                0 &&
                                                                allowance.remaining <
                                                                    allowance.allocated *
                                                                        0.2 && (
                                                                    <div className="bg-orange-50 border border-orange-200 rounded-md p-2">
                                                                        <p className="text-xs text-orange-700">
                                                                            Running
                                                                            low
                                                                            on
                                                                            allowance
                                                                        </p>
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>

                                        <div className="bg-muted/50 border rounded-lg p-4">
                                            <h4 className="text-sm font-semibold mb-2">
                                                Summary
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                <div>
                                                    <p className="text-muted-foreground">
                                                        Total Allocated
                                                    </p>
                                                    <p className="font-semibold">
                                                        {formatCurrency(
                                                            allowances.reduce(
                                                                (sum, a) =>
                                                                    sum +
                                                                    a.allocated,
                                                                0,
                                                            ),
                                                        )}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">
                                                        Total Spent
                                                    </p>
                                                    <p className="font-semibold">
                                                        {formatCurrency(
                                                            allowances.reduce(
                                                                (sum, a) =>
                                                                    sum +
                                                                    a.spent,
                                                                0,
                                                            ),
                                                        )}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">
                                                        Total Remaining
                                                    </p>
                                                    <p
                                                        className={`font-semibold ${
                                                            allowances.reduce(
                                                                (sum, a) =>
                                                                    sum +
                                                                    a.remaining,
                                                                0,
                                                            ) < 0
                                                                ? "text-red-600"
                                                                : "text-green-600"
                                                        }`}
                                                    >
                                                        {formatCurrency(
                                                            allowances.reduce(
                                                                (sum, a) =>
                                                                    sum +
                                                                    a.remaining,
                                                                0,
                                                            ),
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ),
                    },
                ]}
            />
        </div>
    );
}
