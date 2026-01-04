"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wallet, DollarSign, AlertCircle } from "lucide-react";

interface SharedPoolData {
    balance: number;
    totalIncomeThisMonth: number;
    personalAllocationThisMonth: number;
    totalPoolSpent: number;
}

interface PersonalAllowance {
    userId: string;
    userName: string;
    allocated: number;
    spent: number;
    remaining: number;
    carriedOver: number;
    carriedTo: number;
}

interface Reimbursement {
    id: string;
    userId: string;
    userName: string;
    month: string;
    amount: number;
    description: string;
    settled: boolean;
}

interface SharedPoolSummaryProps {
    month?: string;
    refreshKey?: number;
}

export function SharedPoolSummary({
    month,
    refreshKey,
}: SharedPoolSummaryProps) {
    const [loading, setLoading] = useState(true);
    const [pool, setPool] = useState<SharedPoolData | null>(null);
    const [allowances, setAllowances] = useState<PersonalAllowance[]>([]);
    const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
    const [totalReimbursementsOwed, setTotalReimbursementsOwed] = useState(0);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const monthParam = month || getCurrentMonth();

            // Load everything from the shared-pool API
            const poolRes = await fetch(`/api/shared-pool?month=${monthParam}`);
            if (poolRes.ok) {
                const data = await poolRes.json();
                setPool(data.pool);
                setAllowances(data.allowances || []);
                setReimbursements(data.reimbursements || []);
                setTotalReimbursementsOwed(data.totalReimbursementsOwed || 0);
            }
        } catch (error) {
            console.error("Error loading shared pool data:", error);
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => {
        loadData();
    }, [loadData, refreshKey]);

    const getCurrentMonth = () => {
        const now = new Date();
        const year = now.getFullYear();
        const monthNum = String(now.getMonth() + 1).padStart(2, "0");
        return `${year}-${monthNum}`;
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-IE", {
            style: "currency",
            currency: "EUR",
        }).format(amount);
    };

    const formatMonth = (monthStr: string) => {
        const [year, month] = monthStr.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString("en-IE", {
            month: "long",
            year: "numeric",
        });
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-muted-foreground">Loading...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const hasIncomeThisMonth = pool && pool.totalIncomeThisMonth > 0;
    const hasReimbursements = reimbursements.length > 0;

    if (!hasIncomeThisMonth && !hasReimbursements) {
        const monthDisplay = month ? formatMonth(month) : "this month";
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="font-semibold text-yellow-900 mb-2">
                    No Shared Pool Data for {monthDisplay}
                </h3>
                <p className="text-sm text-yellow-800 mb-4">
                    The shared pool has not been initialized for {monthDisplay}.
                    This happens when no income was added for this month.
                </p>
                <p className="text-xs text-yellow-700">
                    To create a shared pool for {monthDisplay}, add income for
                    that month. The pool will be automatically set up with
                    personal allowances based on your settings.
                </p>
                <p className="text-xs text-yellow-700 mt-2">
                    Expenses can still be tracked without a pool - they will
                    create reimbursements that need to be settled manually.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex gap-2 items-start">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-900">
                        <p className="font-medium mb-1">Income Allocation</p>
                        <p>
                            Income received on day 24 onwards is automatically
                            allocated to the next month. For example, salary
                            received on Dec 25, 2025 is allocated to January
                            2026 allowances.
                        </p>
                    </div>
                </div>
            </div>

            {!hasIncomeThisMonth && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-900">
                        <strong>No pool data for this month.</strong> Add income
                        to initialize the shared pool with personal allowances.
                    </p>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
                        All-Time Pool
                    </h3>
                    <div className="flex-1 h-px bg-border"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-2 border-primary/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Pool Balance
                            </CardTitle>
                            <Wallet className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-primary">
                                {formatCurrency(pool?.balance || 0)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Available now (continuous)
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Total Pool Spent
                            </CardTitle>
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatCurrency(pool?.totalPoolSpent || 0)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                All-time deducted from pool
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Pending Reimbursements
                            </CardTitle>
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatCurrency(totalReimbursementsOwed)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {reimbursements.length} waiting to be settled
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
                        {month
                            ? `Current month: ${formatMonth(month)}`
                            : "Current Month"}
                    </h3>
                    <div className="flex-1 h-px bg-border"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-2 border-green-200 bg-green-50/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Income Added
                            </CardTitle>
                            <DollarSign className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-700">
                                {formatCurrency(
                                    pool?.totalIncomeThisMonth || 0,
                                )}
                            </div>
                            <p className="text-xs text-green-700/70">
                                Allowances allocated:{" "}
                                {formatCurrency(
                                    pool?.personalAllocationThisMonth || 0,
                                )}
                            </p>
                            <p className="text-xs text-green-700/70 mt-1">
                                To pool:{" "}
                                {formatCurrency(
                                    (pool?.totalIncomeThisMonth || 0) -
                                        (pool?.personalAllocationThisMonth ||
                                            0),
                                )}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-2 border-orange-200 bg-orange-50/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Total Spent
                            </CardTitle>
                            <Wallet className="h-4 w-4 text-orange-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-700">
                                {formatCurrency(
                                    allowances.reduce(
                                        (sum, a) => sum + a.spent,
                                        0,
                                    ),
                                )}
                            </div>
                            <p className="text-xs text-orange-700/70">
                                From personal allowances
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {allowances.length > 0 && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allowances.map((allowance) => (
                            <Card key={allowance.userId}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        {allowance.userName}
                                    </CardTitle>
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div>
                                            <div className="text-2xl font-bold">
                                                {formatCurrency(
                                                    allowance.remaining,
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Available balance
                                            </p>
                                        </div>

                                        {allowance.carriedOver !== 0 && (
                                            <div className="text-xs">
                                                <span
                                                    className={
                                                        allowance.carriedOver >
                                                        0
                                                            ? "text-green-600"
                                                            : "text-red-600"
                                                    }
                                                >
                                                    {allowance.carriedOver > 0
                                                        ? "+"
                                                        : ""}
                                                    {formatCurrency(
                                                        allowance.carriedOver,
                                                    )}{" "}
                                                    carried from last month
                                                </span>
                                            </div>
                                        )}

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

                                        <div className="mt-2">
                                            <div className="w-full bg-muted rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full ${
                                                        allowance.remaining < 0
                                                            ? "bg-red-500"
                                                            : "bg-green-500"
                                                    }`}
                                                    style={{
                                                        width: `${Math.min(
                                                            100,
                                                            Math.max(
                                                                0,
                                                                allowance.allocated >
                                                                    0
                                                                    ? ((allowance.allocated -
                                                                          allowance.spent) /
                                                                          allowance.allocated) *
                                                                          100
                                                                    : 100,
                                                            ),
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {allowance.remaining < 0 && (
                                            <p className="text-xs text-red-600 mt-1">
                                                Overspent by{" "}
                                                {formatCurrency(
                                                    Math.abs(
                                                        allowance.remaining,
                                                    ),
                                                )}
                                            </p>
                                        )}

                                        {allowance.remaining >
                                            allowance.allocated * 0.5 &&
                                            allowance.allocated > 0 && (
                                                <p className="text-xs text-green-600 mt-1">
                                                    Saving{" "}
                                                    {formatCurrency(
                                                        allowance.remaining,
                                                    )}{" "}
                                                    this month
                                                </p>
                                            )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {reimbursements.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold">
                            Pending Reimbursements
                        </h4>
                        <p className="text-xs text-muted-foreground">
                            {reimbursements.length} pending
                        </p>
                    </div>
                    <div className="border rounded-lg">
                        <div className="divide-y">
                            {reimbursements.map((reimbursement) => {
                                const currentMonth = month || getCurrentMonth();
                                const isFromPreviousMonth =
                                    reimbursement.month < currentMonth;
                                return (
                                    <div
                                        key={reimbursement.id}
                                        className={`p-4 flex items-center justify-between ${
                                            isFromPreviousMonth
                                                ? "bg-yellow-50"
                                                : ""
                                        }`}
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {reimbursement.userName}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {reimbursement.description}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-xs text-muted-foreground">
                                                    {formatMonth(
                                                        reimbursement.month,
                                                    )}
                                                </p>
                                                {isFromPreviousMonth && (
                                                    <span className="text-xs px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded-full">
                                                        Overdue
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">
                                                {formatCurrency(
                                                    reimbursement.amount,
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                From pool
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
