"use client";

import {
    BarChart,
    Bar,
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
    amount: number;
    type: string;
    splits: {
        userId: string;
        amount: number;
    }[];
}

interface MonthlyOverviewChartProps {
    expenses: Expense[];
    users: User[];
}

const USER_COLORS: { [key: string]: string[] } = {
    personal: [
        "#1e40af",
        "#be185d",
        "#047857",
        "#d97706",
        "#7c3aed",
        "#dc2626",
    ],
    shared: ["#3b82f6", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"],
};

export default function MonthlyOverviewChart({
    expenses,
    users,
}: MonthlyOverviewChartProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatYAxis = (value: number) => {
        if (value >= 1000) {
            return `€${(value / 1000).toFixed(1)}k`;
        }
        return `€${value}`;
    };

    // Group expenses by month
    const monthlyData: {
        [monthKey: string]: {
            [userId: string]: { personal: number; shared: number };
        };
    } = {};

    expenses.forEach((expense) => {
        const date = new Date(expense.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {};
            users.forEach((user) => {
                monthlyData[monthKey][user.id] = { personal: 0, shared: 0 };
            });
        }

        expense.splits.forEach((split) => {
            // Ensure user is initialized in this month
            if (!monthlyData[monthKey][split.userId]) {
                monthlyData[monthKey][split.userId] = {
                    personal: 0,
                    shared: 0,
                };
            }

            if (expense.type === "personal") {
                monthlyData[monthKey][split.userId].personal += split.amount;
            } else {
                monthlyData[monthKey][split.userId].shared += split.amount;
            }
        });
    });

    // Format for recharts
    const chartData = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, userData]) => {
            const [year, month] = monthKey.split("-");
            const date = new Date(parseInt(year), parseInt(month) - 1);
            const monthLabel = date.toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
            });

            const dataPoint: { month: string; [key: string]: string | number } =
                {
                    month: monthLabel,
                };

            users.forEach((user) => {
                dataPoint[`${user.name} Personal`] =
                    userData[user.id]?.personal || 0;
                dataPoint[`${user.name} Shared`] =
                    userData[user.id]?.shared || 0;
            });

            return dataPoint;
        });

    if (chartData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Monthly Spending Overview</CardTitle>
                    <CardDescription>No data available</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-100 text-muted-foreground">
                        No monthly data to display
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Monthly Spending Overview</CardTitle>
                <CardDescription>
                    Track personal and shared spending per person across months
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div style={{ width: "100%", height: 400 }}>
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chartData}>
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
                            {users.map((user, index) => [
                                <Bar
                                    key={`${user.id}-personal`}
                                    dataKey={`${user.name} Personal`}
                                    fill={
                                        USER_COLORS.personal[
                                            index % USER_COLORS.personal.length
                                        ]
                                    }
                                    stackId={user.id}
                                />,
                                <Bar
                                    key={`${user.id}-shared`}
                                    dataKey={`${user.name} Shared`}
                                    fill={
                                        USER_COLORS.shared[
                                            index % USER_COLORS.shared.length
                                        ]
                                    }
                                    stackId={user.id}
                                />,
                            ])}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
