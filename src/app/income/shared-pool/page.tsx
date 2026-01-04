"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAccountingMode } from "@/hooks/use-accounting-mode";
import { AccountingModeIndicator } from "@/components/AccountingModeIndicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
    Plus,
    Loader2,
    ArrowLeft,
    Trash2,
    DollarSign,
    Receipt,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface User {
    id: string;
    name: string;
    email: string | null;
}

interface Income {
    id: string;
    userId: string;
    amount: number;
    date: string;
    description: string | null;
    allocatedToMonth: string | null;
    createdAt: string;
    user: User;
}

export default function SharedPoolIncomePage() {
    const _router = useRouter();
    const { accountingMode: _accountingMode, loading: modeLoading } =
        useAccountingMode();

    const [incomes, setIncomes] = useState<Income[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    );
    const [selectedYear, setSelectedYear] = useState<string>(
        new Date().getFullYear().toString(),
    );
    const [incomeToDelete, setIncomeToDelete] = useState<Income | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        userId: "",
    });

    const loadUsers = useCallback(async () => {
        try {
            const res = await fetch("/api/users");
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
                if (data.length > 0 && !formData.userId) {
                    setFormData((prev) => ({ ...prev, userId: data[0].id }));
                }
            }
        } catch (error) {
            console.error("Error loading users:", error);
            toast({
                title: "Error",
                description: "Failed to load users",
            });
        }
    }, [formData.userId]);

    const loadIncomes = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedMonth !== "all") {
                params.append("month", selectedMonth);
            } else if (selectedYear !== "all") {
                params.append("year", selectedYear);
            }

            const res = await fetch(`/api/income?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setIncomes(data.incomes || []);
            }
        } catch (error) {
            console.error("Error loading incomes:", error);
            toast({
                title: "Error",
                description: "Failed to load income",
            });
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        loadIncomes();
    }, [loadIncomes]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (
            !formData.userId ||
            !formData.amount ||
            parseFloat(formData.amount) <= 0
        ) {
            toast({
                title: "Validation Error",
                description:
                    "Please fill in all required fields with valid values",
            });
            return;
        }

        try {
            const res = await fetch("/api/income/shared-pool", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: formData.userId,
                    amount: parseFloat(formData.amount),
                    date: new Date(formData.date).toISOString(),
                    description: formData.description || null,
                }),
            });

            if (res.ok) {
                toast({
                    title: "Success",
                    description: "Income added successfully",
                });
                setFormData({
                    date: new Date().toISOString().split("T")[0],
                    description: "",
                    amount: "",
                    userId: formData.userId,
                });
                setShowAddDialog(false);
                loadIncomes();
            } else {
                const error = await res.json();
                toast({
                    title: "Error",
                    description: error.error || "Failed to add income",
                });
            }
        } catch (error) {
            console.error("Error adding income:", error);
            toast({
                title: "Error",
                description: "Failed to add income",
            });
        }
    };

    const handleDelete = async () => {
        if (!incomeToDelete) return;

        setDeleting(true);
        try {
            const res = await fetch(`/api/income/${incomeToDelete.id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                toast({
                    title: "Success",
                    description: "Income deleted successfully",
                });
                setIncomeToDelete(null);
                loadIncomes();
            } else {
                const error = await res.json();
                toast({
                    title: "Error",
                    description: error.error || "Failed to delete income",
                });
            }
        } catch (error) {
            console.error("Error deleting income:", error);
            toast({
                title: "Error",
                description: "Failed to delete income",
            });
        } finally {
            setDeleting(false);
        }
    };

    const getMonthOptions = () => {
        const months = [];
        for (let i = 0; i < 12; i++) {
            const monthNum = String(i + 1).padStart(2, "0");
            months.push({
                value: `${selectedYear}-${monthNum}`,
                label: new Date(parseInt(selectedYear), i).toLocaleDateString(
                    "en-IE",
                    { month: "long" },
                ),
            });
        }
        return months;
    };

    const getYearOptions = () => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let i = currentYear; i >= currentYear - 5; i--) {
            years.push(i.toString());
        }
        return years;
    };

    const formatMonth = (monthStr: string) => {
        const [year, month] = monthStr.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString("en-IE", {
            month: "long",
            year: "numeric",
        });
    };

    const getFormattedPeriod = () => {
        if (selectedYear === "all") {
            return "All Time";
        }
        if (selectedMonth === "all") {
            return `All of ${selectedYear}`;
        }
        return formatMonth(selectedMonth);
    };

    const getAllocatedMonthDisplay = (income: Income) => {
        const incomeDate = new Date(income.date);
        const allocatedMonth = income.allocatedToMonth;

        if (!allocatedMonth) {
            return null;
        }

        const incomeMonthStr = `${incomeDate.getFullYear()}-${String(incomeDate.getMonth() + 1).padStart(2, "0")}`;

        if (allocatedMonth !== incomeMonthStr) {
            return (
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                    Allocated to {formatMonth(allocatedMonth)}
                </span>
            );
        }

        return null;
    };

    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);

    if (modeLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-linear-to-b from-background to-muted/20">
            <div className="container mx-auto p-4 md:p-8 max-w-6xl">
                <div className="mb-6">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-4">
                            <Link href="/">
                                <Button variant="ghost" size="icon">
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-3xl font-bold">
                                    Income Management
                                </h1>
                                <p className="text-muted-foreground">
                                    Track and manage shared pool income
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link href="/expenses/shared-pool">
                                <Button variant="outline">
                                    <Receipt className="mr-2 h-4 w-4" />
                                    Expenses
                                </Button>
                            </Link>
                            <AccountingModeIndicator />
                        </div>
                    </div>
                </div>

                <Card className="bg-linear-to-r from-blue-50 to-indigo-50 border-blue-200">
                    <CardHeader className="pb-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-lg">
                                    Viewing: {getFormattedPeriod()}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Select a period to view income
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
                                            if (value === "all") {
                                                setSelectedMonth("all");
                                            } else {
                                                const currentMonth = String(
                                                    new Date().getMonth() + 1,
                                                ).padStart(2, "0");
                                                setSelectedMonth(
                                                    `${value}-${currentMonth}`,
                                                );
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="w-32">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                All Years
                                            </SelectItem>
                                            {getYearOptions().map((year) => (
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

                                {selectedYear !== "all" && (
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
                                                <SelectItem value="all">
                                                    All Months
                                                </SelectItem>
                                                {getMonthOptions().map(
                                                    (month) => (
                                                        <SelectItem
                                                            key={month.value}
                                                            value={month.value}
                                                        >
                                                            {month.label}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="mb-6 flex justify-end">
                    <Dialog
                        open={showAddDialog}
                        onOpenChange={setShowAddDialog}
                    >
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Income
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Income</DialogTitle>
                                <DialogDescription>
                                    Add income to the shared pool. Income
                                    received on day 24+ will be allocated to the
                                    next month.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <Label htmlFor="user">User</Label>
                                    <Select
                                        value={formData.userId}
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                userId: value,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select user" />
                                        </SelectTrigger>
                                        <SelectContent>
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

                                <div>
                                    <Label htmlFor="amount">Amount (€)</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        min="0"
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
                                    <Label htmlFor="description">
                                        Description (Optional)
                                    </Label>
                                    <Input
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                description: e.target.value,
                                            })
                                        }
                                        placeholder="e.g., Salary, Bonus, etc."
                                    />
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowAddDialog(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit">Add Income</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            Total Income
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">
                            {formatCurrency(totalIncome)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            {selectedMonth !== "all"
                                ? `For ${formatMonth(selectedMonth)}`
                                : selectedYear !== "all"
                                  ? `For ${selectedYear}`
                                  : "All time"}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Income Entries</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {incomes.length === 0 ? (
                            <div className="text-center py-12">
                                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground mb-4">
                                    No income entries found
                                </p>
                                <Button onClick={() => setShowAddDialog(true)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Your First Income
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {incomes.map((income) => (
                                    <div
                                        key={income.id}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold">
                                                    {income.user.name}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    •
                                                </span>
                                                <span className="text-sm text-muted-foreground">
                                                    {new Date(
                                                        income.date,
                                                    ).toLocaleDateString(
                                                        "en-IE",
                                                        {
                                                            year: "numeric",
                                                            month: "short",
                                                            day: "numeric",
                                                        },
                                                    )}
                                                </span>
                                                {getAllocatedMonthDisplay(
                                                    income,
                                                )}
                                            </div>
                                            {income.description && (
                                                <p className="text-sm text-muted-foreground">
                                                    {income.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-xl font-bold text-green-600">
                                                    {formatCurrency(
                                                        income.amount,
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    setIncomeToDelete(income)
                                                }
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {incomeToDelete && (
                <Dialog
                    open={!!incomeToDelete}
                    onOpenChange={(open) => !open && setIncomeToDelete(null)}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete Income?</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete this income
                                entry for{" "}
                                {formatCurrency(incomeToDelete.amount)}? This
                                will affect the shared pool calculations and
                                personal allowances.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button
                                variant="outline"
                                onClick={() => setIncomeToDelete(null)}
                                disabled={deleting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    "Delete"
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
