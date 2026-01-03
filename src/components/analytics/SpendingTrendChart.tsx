"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
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

interface Expense {
    id: string;
    date: string;
    splits: {
        userId: string;
        amount: number;
    }[];
}

interface SpendingTrendChartProps {
    expenses: Expense[];
    users: User[];
}

const USER_COLORS = [
    "#3b82f6", // blue
    "#ec4899", // pink
    "#10b981", // green
    "#f59e0b", // amber
    "#8b5cf6", // violet
    "#ef4444", // red
];

export default function SpendingTrendChart({
    expenses,
    users,
}: SpendingTrendChartProps) {
    const formatYAxis = (value: number) => {
        if (value >= 1000) {
            return `€${(value / 1000).toFixed(1)}k`;
        }
        return `€${value}`;
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    // Group expenses by month and user
    const monthlyData: {
        [monthKey: string]: { [userId: string]: number };
    } = {};

    expenses.forEach((expense) => {
        const date = new Date(expense.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {};
            users.forEach((user) => {
                monthlyData[monthKey][user.id] = 0;
            });
        }

        expense.splits.forEach((split) => {
            monthlyData[monthKey][split.userId] =
                (monthlyData[monthKey][split.userId] || 0) + split.amount;
        });
    });

    // Format data for recharts
    const chartData = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, userData]) => {
            const [year, month] = monthKey.split("-");
            const date = new Date(parseInt(year), parseInt(month) - 1);
            const monthLabel = date.toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
            });

            const dataPoint: {
                month: string;
                Total: number;
                [key: string]: string | number;
            } = {
                month: monthLabel,
                Total: 0,
            };

            let total = 0;
            users.forEach((user) => {
                const amount = userData[user.id] || 0;
                dataPoint[user.name] = amount;
                total += amount;
            });
            dataPoint.Total = total;

            return dataPoint;
        });

    if (chartData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Spending Trends Over Time</CardTitle>
                    <CardDescription>No data available</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-75 text-muted-foreground">
                        No trend data to display
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Spending Trends Over Time</CardTitle>
                <CardDescription>
                    Monthly spending comparison over time
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="month"
                                angle={-45}
                                textAnchor="end"
                                height={100}
                            />
                            <YAxis
                                tickFormatter={(value) => formatYAxis(value)}
                                width={60}
                            />
                            <Tooltip
                                formatter={(value) =>
                                    formatCurrency(Number(value))
                                }
                            />
                            <Legend />
                            {users.map((user, index) => (
                                <Line
                                    key={user.id}
                                    type="monotone"
                                    dataKey={user.name}
                                    stroke={
                                        USER_COLORS[index % USER_COLORS.length]
                                    }
                                    strokeWidth={2}
                                />
                            ))}
                            <Line
                                type="monotone"
                                dataKey="Total"
                                stroke="#64748b"
                                strokeWidth={3}
                                strokeDasharray="5 5"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
