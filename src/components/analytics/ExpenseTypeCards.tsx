"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface User {
    id: string;
    name: string;
}

interface Expense {
    id: string;
    amount: number;
    type: string;
    splits: Array<{
        userId: string;
        amount: number;
    }>;
}

interface ExpenseTypeCardsProps {
    expenses: Expense[];
    users: User[];
}

export default function ExpenseTypeCards({
    expenses,
    users,
}: ExpenseTypeCardsProps) {
    // Calculate personal expenses per user
    const personalExpenses: { [userId: string]: number } = {};
    users.forEach((user) => {
        personalExpenses[user.id] = expenses
            .filter((exp) => exp.type === "personal")
            .reduce((sum, exp) => {
                const split = exp.splits.find((s) => s.userId === user.id);
                return sum + (split?.amount || 0);
            }, 0);
    });

    // Calculate shared expenses per user
    const sharedExpenses: { [userId: string]: number } = {};
    users.forEach((user) => {
        sharedExpenses[user.id] = expenses
            .filter((exp) => exp.type === "shared")
            .reduce((sum, exp) => {
                const split = exp.splits.find((s) => s.userId === user.id);
                return sum + (split?.amount || 0);
            }, 0);
    });

    // Calculate totals
    const totalPersonal = Object.values(personalExpenses).reduce(
        (sum, val) => sum + val,
        0,
    );
    const totalShared = expenses
        .filter((exp) => exp.type === "shared")
        .reduce((sum, exp) => sum + exp.amount, 0);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency: "EUR",
        }).format(amount);
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                            Total Personal Expenses
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {formatCurrency(totalPersonal)}
                        </p>
                        <div className="mt-2 space-y-1">
                            {users.map((user) => (
                                <p
                                    key={user.id}
                                    className="text-sm text-muted-foreground"
                                >
                                    {user.name}:{" "}
                                    {formatCurrency(personalExpenses[user.id])}
                                </p>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                            Total Shared Expenses
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {formatCurrency(totalShared)}
                        </p>
                        <div className="mt-2 space-y-1">
                            {users.map((user) => (
                                <p
                                    key={user.id}
                                    className="text-sm text-muted-foreground"
                                >
                                    {user.name}&apos;s share:{" "}
                                    {formatCurrency(sharedExpenses[user.id])}
                                </p>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Individual User Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {users.map((user) => (
                    <Card key={user.id}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">
                                {user.name} - Total Expenses
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">
                                {formatCurrency(
                                    personalExpenses[user.id] +
                                        sharedExpenses[user.id],
                                )}
                            </p>
                            <div className="mt-2 space-y-1">
                                <p className="text-sm text-muted-foreground">
                                    Personal:{" "}
                                    {formatCurrency(personalExpenses[user.id])}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Shared:{" "}
                                    {formatCurrency(sharedExpenses[user.id])}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
