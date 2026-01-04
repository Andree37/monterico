"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface User {
    id: string;
    name: string;
}

interface Income {
    id: string;
    userId: string;
    amount: number;
    date: string;
}

interface Expense {
    id: string;
    date: string;
    splits: {
        userId: string;
        amount: number;
    }[];
}

interface SummaryCardsProps {
    incomes: Income[];
    expenses: Expense[];
    users: User[];
}

export default function SummaryCards({
    incomes,
    expenses,
    users,
}: SummaryCardsProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency: "EUR",
        }).format(amount);
    };

    // Calculate total income per user
    const userIncomes: { [userId: string]: number } = {};
    users.forEach((user) => {
        userIncomes[user.id] = incomes
            .filter((inc) => inc.userId === user.id)
            .reduce((sum, inc) => sum + inc.amount, 0);
    });

    // Calculate total expenses per user
    const userExpenses: { [userId: string]: number } = {};
    users.forEach((user) => {
        userExpenses[user.id] = expenses.reduce((sum, exp) => {
            const userSplit = exp.splits.find((s) => s.userId === user.id);
            return sum + (userSplit?.amount || 0);
        }, 0);
    });

    // Calculate totals
    const totalIncome = Object.values(userIncomes).reduce(
        (sum, val) => sum + val,
        0,
    );
    const totalExpenses = Object.values(userExpenses).reduce(
        (sum, val) => sum + val,
        0,
    );
    const totalSaved = totalIncome - totalExpenses;

    // Calculate savings rates
    const userSaved: { [userId: string]: number } = {};
    const userSavingsRate: { [userId: string]: number } = {};
    users.forEach((user) => {
        userSaved[user.id] = userIncomes[user.id] - userExpenses[user.id];
        userSavingsRate[user.id] =
            userIncomes[user.id] > 0
                ? (userSaved[user.id] / userIncomes[user.id]) * 100
                : 0;
    });

    const overallSavingsRate =
        totalIncome > 0 ? (totalSaved / totalIncome) * 100 : 0;

    // Calculate month count based on expenses
    const uniqueMonths = new Set<string>();

    expenses.forEach((exp) => {
        const date = new Date(exp.date);
        uniqueMonths.add(`${date.getFullYear()}-${date.getMonth()}`);
    });

    const monthCount = uniqueMonths.size || 1;

    return (
        <div className="space-y-6">
            {/* Overall Summary - Monthly Averages */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                            Avg Monthly Income
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {formatCurrency(totalIncome / monthCount)}
                        </p>
                        <div className="mt-2 space-y-1">
                            {users.map((user) => (
                                <p
                                    key={user.id}
                                    className="text-xs text-muted-foreground"
                                >
                                    {user.name}:{" "}
                                    {formatCurrency(
                                        userIncomes[user.id] / monthCount,
                                    )}
                                </p>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                            Avg Monthly Expenses
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {formatCurrency(totalExpenses / monthCount)}
                        </p>
                        <div className="mt-2 space-y-1">
                            {users.map((user) => (
                                <p
                                    key={user.id}
                                    className="text-xs text-muted-foreground"
                                >
                                    {user.name}:{" "}
                                    {formatCurrency(
                                        userExpenses[user.id] / monthCount,
                                    )}
                                </p>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card
                    className={
                        totalSaved >= 0
                            ? "border-green-200 bg-green-50"
                            : "border-red-200 bg-red-50"
                    }
                >
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                            Avg Monthly Saved
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p
                            className={`text-2xl font-bold ${totalSaved >= 0 ? "text-green-700" : "text-red-700"}`}
                        >
                            {formatCurrency(totalSaved / monthCount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {overallSavingsRate.toFixed(1)}% savings rate
                        </p>
                        <p className="text-xs font-medium mt-2">
                            {totalSaved >= 0 ? "Winning!" : "Losing Money"}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                            Period
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{monthCount}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Month{monthCount !== 1 ? "s" : ""}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Individual User Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {users.map((user: User) => {
                    const monthlySaved = userSaved[user.id] / monthCount;
                    return (
                        <Card
                            key={user.id}
                            className={
                                monthlySaved >= 0
                                    ? "border-green-200"
                                    : "border-red-200"
                            }
                        >
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium">
                                    {user.name} - Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        Avg Monthly Income
                                    </p>
                                    <p className="text-lg font-semibold">
                                        {formatCurrency(
                                            userIncomes[user.id] / monthCount,
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        Avg Monthly Expenses
                                    </p>
                                    <p className="text-lg font-semibold">
                                        {formatCurrency(
                                            userExpenses[user.id] / monthCount,
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        Avg Monthly Saved
                                    </p>
                                    <p
                                        className={`text-lg font-semibold ${
                                            userSaved[user.id] >= 0
                                                ? "text-green-600"
                                                : "text-red-600"
                                        }`}
                                    >
                                        {formatCurrency(
                                            userSaved[user.id] / monthCount,
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {userSavingsRate[user.id].toFixed(1)}%
                                        rate
                                    </p>
                                    <p className="text-xs font-medium mt-1">
                                        {monthlySaved >= 0
                                            ? "Winning"
                                            : "Losing"}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
