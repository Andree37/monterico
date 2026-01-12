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

export default function IndividualIncomePage() {
    const router = useRouter();
    const { accountingMode, loading: modeLoading } = useAccountingMode();

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

    useEffect(() => {
        if (!modeLoading && accountingMode !== "individual") {
            router.replace("/income/shared-pool");
        }
    }, [accountingMode, modeLoading, router]);

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
            // Load ALL incomes without month filter to populate dropdowns
            const res = await fetch(`/api/income`);
            if (res.ok) {
                const data = await res.json();
                setIncomes(data.incomes || []);
            } else {
                throw new Error("Failed to fetch incomes");
            }
        } catch (error) {
            console.error("Error loading incomes:", error);
            toast.error("Failed to load incomes");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (accountingMode === "individual") {
            loadUsers();
            loadIncomes();
        }
    }, [accountingMode, loadUsers, loadIncomes]);

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

            const res = await fetch("/api/income", {
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
                throw new Error(error.message || "Failed to add income");
            }
        } catch (error) {
            console.error("Error adding income:", error);
            toast.error(
                error instanceof Error ? error.message : "Failed to add income",
            );
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
                throw new Error("Failed to delete income");
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
        return Array.from(years).sort();
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

    const filteredIncomes = incomes.filter((income) => {
        if (!selectedMonth || selectedMonth === "all") return true;
        const incomeMonth =
            income.allocatedToMonth ||
            `${new Date(income.date).getFullYear()}-${String(new Date(income.date).getMonth() + 1).padStart(2, "0")}`;
        return incomeMonth === selectedMonth;
    });

    const totalIncome = filteredIncomes.reduce(
        (sum, income) => sum + income.amount,
        0,
    );

    const availableYears = getAvailableYears();
    const availableMonthsInYear = getAvailableMonthsInYear();

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
        if (!selectedMonth || selectedMonth === "all") {
            return `All Time (${selectedYear})`;
        }
        const [year, month] = selectedMonth.split("-");
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    };

    if (modeLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex justify-end">
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
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
                                Record a new income entry
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="user">Household Member</Label>
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

                            <div>
                                <Label htmlFor="date">Date</Label>
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

                            <div>
                                <Label htmlFor="amount">Amount</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
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

                            <div>
                                <Label htmlFor="allocatedToMonth">
                                    Allocated to Month
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
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select month" />
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
                            </div>

                            <div>
                                <Label htmlFor="description">Description</Label>
                                <Input
                                    id="description"
                                    placeholder="e.g., Salary, Bonus"
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            description: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <Button type="submit" className="w-full">
                                Add Income
                            </Button>
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
                                Select a period to view income data
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
                                        const monthsInNewYear =
                                            getAvailableMonths()
                                                .filter((m) =>
                                                    m.startsWith(value),
                                                )
                                                .map((m) => m.split("-")[1]);
                                        if (monthsInNewYear.length > 0) {
                                            // Set to first available month in the new year
                                            setSelectedMonth(
                                                `${value}-${monthsInNewYear[0]}`,
                                            );
                                        } else {
                                            // No data for this year, show all
                                            setSelectedMonth("all");
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
                                    value={
                                        selectedMonth === "all" ||
                                        !selectedMonth
                                            ? "all"
                                            : selectedMonth.split("-")[1]
                                    }
                                    onValueChange={(value) =>
                                        setSelectedMonth(
                                            value === "all"
                                                ? "all"
                                                : `${selectedYear}-${value}`,
                                        )
                                    }
                                >
                                    <SelectTrigger className="w-40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All Months
                                        </SelectItem>
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

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Total Income: {formatCurrency(totalIncome)}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : filteredIncomes.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No income entries found for this period
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredIncomes.map((income) => (
                                <div
                                    key={income.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                                {income.user.name}
                                            </span>
                                            {income.description && (
                                                <>
                                                    <span className="text-muted-foreground">
                                                        •
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        {income.description}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {new Date(
                                                income.date,
                                            ).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="font-semibold text-green-600">
                                                {formatCurrency(income.amount)}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                                setIncomeToDelete(income)
                                            }
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={!!incomeToDelete}
                onOpenChange={(open) => !open && setIncomeToDelete(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Income</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this income entry?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2 justify-end">
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
        </div>
    );
}
