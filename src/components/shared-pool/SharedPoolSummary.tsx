"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, DollarSign } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface PersonalAllowance {
    householdMemberId: string;
    memberName: string | null;
    allocated: number;
    spent: number;
    remaining: number;
    carriedOver: number;
    carriedTo: number;
    cumulativeAllocated: number;
    cumulativeSpent: number;
    cumulativeSaved: number;
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

    // Monthly metrics
    const [totalIncome, setTotalIncome] = useState(0);
    const [totalPoolExpenses, setTotalPoolExpenses] = useState(0);
    const [amountToPool, setAmountToPool] = useState(0);

    // Cumulative metrics
    const [cumulativePoolBalance, setCumulativePoolBalance] = useState(0);

    const [allowances, setAllowances] = useState<PersonalAllowance[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const monthParam = month || getCurrentMonth();

            const poolRes = await fetch(`/api/shared-pool?month=${monthParam}`);
            if (poolRes.ok) {
                const data = await poolRes.json();

                // Monthly metrics
                setTotalIncome(data.totalIncome || 0);
                setTotalPoolExpenses(data.totalPoolExpenses || 0);
                setAmountToPool(data.amountToPool || 0);

                // Cumulative metrics
                setCumulativePoolBalance(data.cumulativePoolBalance || 0);

                setAllowances(data.memberAllowances || []);
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
            <div className="space-y-6">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-muted-foreground">Loading...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const monthlyPoolBalance = amountToPool - totalPoolExpenses;
    const poolHealthPercentage =
        amountToPool > 0
            ? Math.max(
                  0,
                  Math.min(100, (monthlyPoolBalance / amountToPool) * 100),
              )
            : 100;

    return (
        <div className="space-y-6">
            {/* Combined Pool Overview */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Total Pool Balance */}
                <Card className="border-2 border-blue-200 bg-blue-50/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-blue-600" />
                            Total Pool Balance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-700">
                            {formatCurrency(cumulativePoolBalance)}
                        </div>
                        <p className="text-xs text-blue-700/70 mt-1">
                            Available for shared expenses
                        </p>
                    </CardContent>
                </Card>

                {/* This Month Pool Activity */}
                <Card className="border-2 border-green-200 bg-green-50/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            {formatMonth(month || getCurrentMonth())}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs text-muted-foreground">
                                    Income:
                                </span>
                                <span className="text-lg font-semibold text-green-700">
                                    {formatCurrency(totalIncome)}
                                </span>
                            </div>
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs text-muted-foreground">
                                    To pool:
                                </span>
                                <span className="text-sm font-medium text-green-600">
                                    +{formatCurrency(amountToPool)}
                                </span>
                            </div>
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs text-muted-foreground">
                                    Pool spent:
                                </span>
                                <span className="text-sm font-medium text-red-600">
                                    -{formatCurrency(totalPoolExpenses)}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs font-medium">
                                    Pool balance this month:
                                </span>
                                <span
                                    className={`text-lg font-bold ${monthlyPoolBalance >= 0 ? "text-green-600" : "text-red-600"}`}
                                >
                                    {formatCurrency(monthlyPoolBalance)}
                                </span>
                            </div>
                            {/* Monthly Pool Health Bar */}
                            <div className="mt-2">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${
                                            poolHealthPercentage > 50
                                                ? "bg-green-600"
                                                : poolHealthPercentage > 25
                                                  ? "bg-yellow-600"
                                                  : "bg-red-600"
                                        }`}
                                        style={{
                                            width: `${poolHealthPercentage}%`,
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {poolHealthPercentage.toFixed(0)}% of
                                    monthly pool remaining
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Personal Allowances */}
            <div>
                <h3 className="text-sm font-medium mb-3">
                    Personal Allowances
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    {allowances.map((allowance) => (
                        <Card
                            key={allowance.householdMemberId}
                            className={
                                allowance.remaining < 0
                                    ? "border-2 border-red-200 bg-red-50/30"
                                    : ""
                            }
                        >
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium">
                                    {allowance.memberName}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="text-2xl font-bold">
                                        {formatCurrency(allowance.remaining)}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Remaining this month
                                    </p>

                                    <Separator className="my-2" />

                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">
                                            Allocated:
                                        </span>
                                        <span>
                                            {formatCurrency(
                                                allowance.allocated,
                                            )}
                                        </span>
                                    </div>
                                    {allowance.carriedOver > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">
                                                Carried over:
                                            </span>
                                            <span className="text-green-600">
                                                +
                                                {formatCurrency(
                                                    allowance.carriedOver,
                                                )}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">
                                            Spent:
                                        </span>
                                        <span>
                                            {formatCurrency(allowance.spent)}
                                        </span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="mt-3">
                                        <div className="w-full bg-green-200 rounded-full h-2.5">
                                            <div
                                                className="h-2.5 rounded-full transition-all bg-green-600"
                                                style={{
                                                    width: `${Math.max(
                                                        0,
                                                        100 -
                                                            Math.min(
                                                                100,
                                                                (allowance.spent /
                                                                    (allowance.allocated +
                                                                        allowance.carriedOver ||
                                                                        1)) *
                                                                    100,
                                                            ),
                                                    )}%`,
                                                }}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 text-right">
                                            {Math.max(
                                                0,
                                                100 -
                                                    Math.min(
                                                        100,
                                                        (allowance.spent /
                                                            (allowance.allocated +
                                                                allowance.carriedOver ||
                                                                1)) *
                                                            100,
                                                    ),
                                            ).toFixed(0)}
                                            % remaining
                                        </p>
                                    </div>

                                    {allowance.remaining < 0 && (
                                        <p className="text-xs text-red-600 mt-2 font-medium">
                                            ⚠️ Overspent by{" "}
                                            {formatCurrency(
                                                Math.abs(allowance.remaining),
                                            )}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
