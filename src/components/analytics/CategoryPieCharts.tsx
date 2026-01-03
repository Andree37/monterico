"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

interface User {
    id: string;
    name: string;
}

interface CategoryPieChartsProps {
    categoryTotals: { [categoryName: string]: { [userId: string]: number } };
    formatCurrency: (amount: number) => string;
    userTotals: { [userId: string]: number };
    users: User[];
}

const COLORS = [
    "hsl(210, 70%, 60%)",
    "hsl(330, 70%, 60%)",
    "hsl(45, 70%, 60%)",
    "hsl(120, 70%, 60%)",
    "hsl(270, 70%, 60%)",
    "hsl(15, 70%, 60%)",
    "hsl(180, 70%, 60%)",
    "hsl(300, 70%, 60%)",
];

export default function CategoryPieCharts({
    categoryTotals,
    formatCurrency,
    userTotals,
    users,
}: CategoryPieChartsProps) {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => {
                const userTotal = userTotals[user.id] || 0;
                const userData = Object.entries(categoryTotals)
                    .filter(([, totals]) => (totals[user.id] || 0) > 0)
                    .map(([name, totals]) => ({
                        name,
                        value: totals[user.id] || 0,
                    }));

                return (
                    <Card key={user.id}>
                        <CardHeader>
                            <CardTitle>
                                {user.name} - Spending by Category
                            </CardTitle>
                            <CardDescription>
                                Total: {formatCurrency(userTotal)}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {userData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={userData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={true}
                                            label={({ name, value }) =>
                                                `${name}: ${formatCurrency(value)}`
                                            }
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {userData.map((_, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={
                                                        COLORS[
                                                            index %
                                                                COLORS.length
                                                        ]
                                                    }
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value) =>
                                                formatCurrency(Number(value))
                                            }
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-75 text-muted-foreground">
                                    No spending data
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
