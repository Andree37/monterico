"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAccountingMode } from "@/hooks/use-accounting-mode";
import { useSession } from "next-auth/react";
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
import { Plus, Loader2, Trash2, DollarSign } from "lucide-react";
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

export default function SharedPoolIncomePage() {
    const _router = useRouter();
    const { accountingMode: _accountingMode, loading: modeLoading } =
        useAccountingMode();

    const [incomes, setIncomes] = useState<Income[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [selectedYear, setSelectedYear] = useState<string>(
        new Date().getFullYear().toString(),
    );
    const [incomeToDelete, setIncomeToDelete] = useState<Income | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        householdMemberId: "",
        type: "salary",
        allocatedToMonth: getDefaultAllocatedMonth(
            new Date().toISOString().split("T")[0],
        ),
    });

    const { data: session } = useSession();

    const loadUsers = useCallback(async () => {
        try {
            const res = await fetch("/api/users");
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
                if (data.length > 0 && !formData.householdMemberId) {
                    setFormData((prev) => ({
                        ...prev,
                        householdMemberId: data[0].id,
                    }));
                }
            }
        } catch (error) {
            console.error("Error loading users:", error);
            toast.error("Failed to load users");
        }
    }, [formData.householdMemberId]);

    const loadIncomes = useCallback(async () => {
        setLoading(true);
        try {
            // Load ALL incomes without filter to populate dropdowns
            const res = await fetch(`/api/income`);
            if (res.ok) {
                const data = await res.json();
                setIncomes(data.incomes || []);
            }
        } catch (error) {
            console.error("Error loading incomes:", error);
            toast.error("Failed to load income");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
        loadIncomes();
    }, [loadUsers, loadIncomes]);

    // Set initial selected month to current or next month (after 22nd) after incomes load
    useEffect(() => {
        if (incomes.length > 0 && !selectedMonth) {
            const now = new Date();
            const defaultMonth = getDefaultAllocatedMonth(
                now.toISOString().split("T")[0],
            );
            setSelectedMonth(defaultMonth);
        }
    }, [incomes, selectedMonth]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (
            !session?.user?.id ||
            !formData.householdMemberId ||
            !formData.amount ||
            parseFloat(formData.amount) <= 0
        ) {
            toast.error("Please fill in all required fields with valid values");
            return;
        }

        try {
            const allocatedMonth =
                formData.allocatedToMonth ||
                getDefaultAllocatedMonth(formData.date);

            const res = await fetch("/api/income/shared-pool", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    householdMemberId: formData.householdMemberId,
                    amount: parseFloat(formData.amount),
                    date: formData.date,
                    description: formData.description || null,
                    type: formData.type,
                    allocatedToMonth: allocatedMonth,
                }),
            });

            if (res.ok) {
                toast.success("Income added successfully");
                setShowAddDialog(false);
                const newDate = new Date().toISOString().split("T")[0];
                setFormData({
                    date: newDate,
                    description: "",
                    amount: "",
                    householdMemberId: users[0]?.id || "",
                    type: "salary",
                    allocatedToMonth: getDefaultAllocatedMonth(newDate),
                });
                loadIncomes();
            } else {
                const error = await res.json();
                toast.error(error.error || "Failed to add income");
            }
        } catch (error) {
            console.error("Error adding income:", error);
            toast.error("Failed to add income");
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
                toast.success("Income deleted successfully");
                setIncomeToDelete(null);
                loadIncomes();
            } else {
                const error = await res.json();
                toast.error(error.error || "Failed to delete income");
            }
        } catch (error) {
            console.error("Error deleting income:", error);
            toast.error("Failed to delete income");
        } finally {
            setDeleting(false);
        }
    };

    const getAvailableYears = () => {
        const years = new Set<string>();
        incomes.forEach((income) => {
            const year = new Date(income.date).getFullYear().toString();
            years.add(year);
        });
        const currentYear = new Date().getFullYear().toString();
        years.add(currentYear);
        return Array.from(years).sort().reverse();
    };

    const getAvailableMonths = () => {
        const months = new Set<string>();
        incomes.forEach((income) => {
            const month =
                income.allocatedToMonth ||
                `${new Date(income.date).getFullYear()}-${String(new Date(income.date).getMonth() + 1).padStart(2, "0")}`;
            months.add(month);
        });
        return Array.from(months).sort();
    };

    const getAvailableMonthsInYear = () => {
        return getAvailableMonths()
            .filter((m) => m.startsWith(selectedYear))
            .map((m) => m.split("-")[1]);
    };

    const getMonthOptions = () => {
        const availableMonthsInYear = getAvailableMonthsInYear();
        const months = [];
        for (let i = 0; i < 12; i++) {
            const monthNum = String(i + 1).padStart(2, "0");
            // Only include months that have data
            if (availableMonthsInYear.includes(monthNum)) {
                months.push({
                    value: `${selectedYear}-${monthNum}`,
                    label: new Date(
                        parseInt(selectedYear),
                        i,
                    ).toLocaleDateString("en-IE", { month: "long" }),
                });
            }
        }
        return months;
    };

    const getYearOptions = () => {
        return getAvailableYears();
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
        if (selectedYear === "all" || !selectedYear) {
            return "All Time";
        }
        if (selectedMonth === "all" || !selectedMonth) {
            return `All of ${selectedYear}`;
        }
        return formatMonth(selectedMonth);
    };

    const filteredIncomes = incomes.filter((income) => {
        if (!selectedMonth || selectedMonth === "all") {
            // If no month selected, filter by year
            if (selectedYear === "all") return true;
            const incomeYear = new Date(income.date).getFullYear().toString();
            return incomeYear === selectedYear;
        }
        // Filter by specific month
        const incomeMonth =
            income.allocatedToMonth ||
            `${new Date(income.date).getFullYear()}-${String(new Date(income.date).getMonth() + 1).padStart(2, "0")}`;
        return incomeMonth === selectedMonth;
    });

    const totalIncome = filteredIncomes.reduce(
        (sum, income) => sum + income.amount,
        0,
    );

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

    if (modeLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-linear-to-b from-background to-muted/20">
            <div className="container mx-auto p-4 md:p-8 max-w-6xl space-y-6">
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
                                                const monthsInNewYear =
                                                    getAvailableMonths()
                                                        .filter((m) =>
                                                            m.startsWith(value),
                                                        )
                                                        .map(
                                                            (m) =>
                                                                m.split("-")[1],
                                                        );
                                                if (
                                                    monthsInNewYear.length > 0
                                                ) {
                                                    setSelectedMonth(
                                                        `${value}-${monthsInNewYear[0]}`,
                                                    );
                                                } else {
                                                    setSelectedMonth("all");
                                                }
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

                <div className="flex justify-end">
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
                                    Add income to the shared pool and specify
                                    which month it should be allocated to.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="user">
                                        Household Member
                                    </Label>
                                    <Select
                                        value={formData.householdMemberId}
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                householdMemberId: value,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select household member" />
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

                                <div className="space-y-2">
                                    <Label htmlFor="date">Date Received</Label>
                                    <Input
                                        id="date"
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => {
                                            const newDate = e.target.value;
                                            setFormData({
                                                ...formData,
                                                date: newDate,
                                                allocatedToMonth:
                                                    getDefaultAllocatedMonth(
                                                        newDate,
                                                    ),
                                            });
                                        }}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
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

                                <div className="space-y-2">
                                    <Label htmlFor="type">Type</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                type: value,
                                                allocatedToMonth:
                                                    getDefaultAllocatedMonth(
                                                        formData.date,
                                                    ),
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
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
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="allocatedToMonth">
                                        Allocate to Month
                                    </Label>
                                    <Select
                                        value={formData.allocatedToMonth}
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                allocatedToMonth: value,
                                            })
                                        }
                                    >
                                        <SelectTrigger id="allocatedToMonth">
                                            <SelectValue placeholder="Auto-allocate based on date" />
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
                                                    const year =
                                                        date.getFullYear();
                                                    const month = String(
                                                        date.getMonth() + 1,
                                                    ).padStart(2, "0");
                                                    const monthKey = `${year}-${month}`;
                                                    const monthName =
                                                        date.toLocaleDateString(
                                                            "en-IE",
                                                            {
                                                                month: "long",
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
                                    <p className="text-xs text-muted-foreground">
                                        Income received after day 22 defaults to
                                        next month
                                    </p>
                                </div>

                                <div className="space-y-2">
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
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle>Income Entries</CardTitle>
                            <div className="text-2xl font-bold text-green-600">
                                Total: {formatCurrency(totalIncome)}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {filteredIncomes.length === 0 ? (
                            <div className="text-center py-12">
                                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground mb-4">
                                    No income entries found for this period
                                </p>
                                <Button onClick={() => setShowAddDialog(true)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Income
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredIncomes.map((income) => (
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
