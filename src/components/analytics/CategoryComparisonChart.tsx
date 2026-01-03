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

interface CategoryComparisonChartProps {
    categoryTotals: { [categoryName: string]: { [userId: string]: number } };
    formatCurrency: (amount: number) => string;
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

export default function CategoryComparisonChart({
    categoryTotals,
    formatCurrency,
    users,
}: CategoryComparisonChartProps) {
    const formatYAxis = (value: number) => {
        if (value >= 1000) {
            return `€${(value / 1000).toFixed(1)}k`;
        }
        return `€${value}`;
    };

    // Transform data for recharts
    const allCategoryData = Object.entries(categoryTotals).map(
        ([category, userTotals]) => {
            const dataPoint: {
                category: string;
                [key: string]: string | number;
            } = {
                category,
            };
            users.forEach((user) => {
                dataPoint[user.name] = userTotals[user.id] || 0;
            });
            return dataPoint;
        },
    );

    // Filter out categories with no spending
    const filteredData = allCategoryData.filter((item) => {
        return users.some((user) => (item[user.name] as number) > 0);
    });

    // Separate Renda (rent) if it exists for better visualization
    const rendaData = filteredData.filter((item) => item.category === "Renda");
    const otherCategoriesData = filteredData.filter(
        (item) => item.category !== "Renda",
    );

    const hasData = filteredData.length > 0;

    if (!hasData) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Spending by Category</CardTitle>
                    <CardDescription>
                        No spending data available
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-100 text-muted-foreground">
                        No data to display
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            {otherCategoriesData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Spending by Category
                            {rendaData.length > 0 && " (excluding Rent)"}
                        </CardTitle>
                        <CardDescription>
                            Compare spending across categories
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div style={{ width: "100%", height: 400 }}>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={otherCategoriesData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="category"
                                        angle={-45}
                                        textAnchor="end"
                                        height={100}
                                    />
                                    <YAxis
                                        tickFormatter={(value) =>
                                            formatYAxis(value)
                                        }
                                        width={60}
                                    />
                                    <Tooltip
                                        formatter={(value) =>
                                            formatCurrency(Number(value))
                                        }
                                    />
                                    <Legend />
                                    {users.map((user, index) => (
                                        <Bar
                                            key={user.id}
                                            dataKey={user.name}
                                            fill={
                                                USER_COLORS[
                                                    index % USER_COLORS.length
                                                ]
                                            }
                                            isAnimationActive={false}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}

            {rendaData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Renda (Rent)</CardTitle>
                        <CardDescription>
                            Monthly rent expenses shown separately due to scale
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div style={{ width: "100%", height: 200 }}>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={rendaData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="category" />
                                    <YAxis
                                        tickFormatter={(value) =>
                                            formatYAxis(value)
                                        }
                                        width={60}
                                    />
                                    <Tooltip
                                        formatter={(value) =>
                                            formatCurrency(Number(value))
                                        }
                                    />
                                    <Legend />
                                    {users.map((user, index) => (
                                        <Bar
                                            key={user.id}
                                            dataKey={user.name}
                                            fill={
                                                USER_COLORS[
                                                    index % USER_COLORS.length
                                                ]
                                            }
                                            isAnimationActive={false}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}
        </>
    );
}
