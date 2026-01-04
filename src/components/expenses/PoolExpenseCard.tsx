"use client";

import { formatCurrency, formatDate as formatDateUtil } from "@/lib/utils";

interface Category {
    id: string;
    name: string;
    icon: string;
}

interface User {
    id: string;
    name: string;
}

interface Expense {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    paidFromPool: boolean;
    needsReimbursement: boolean;
    category: Category;
    paidBy: User;
}

interface PoolExpenseCardProps {
    expense: Expense;
}

export function PoolExpenseCard({ expense }: PoolExpenseCardProps) {
    const getStatusBadge = () => {
        if (expense.type === "personal") {
            return (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    Personal
                </span>
            );
        }

        if (expense.paidFromPool) {
            return (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                    Pool
                </span>
            );
        }

        return (
            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                Reimbursement
            </span>
        );
    };

    return (
        <div className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xl shrink-0">
                    {expense.category.icon}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                            {expense.description}
                        </p>
                        {getStatusBadge()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {formatDateUtil(expense.date)} • {expense.category.name}{" "}
                        • {expense.paidBy.name}
                    </p>
                </div>
            </div>
            <div className="text-right shrink-0 ml-4">
                <p className="font-semibold text-sm">
                    {formatCurrency(expense.amount)}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                    {expense.type}
                </p>
            </div>
        </div>
    );
}
