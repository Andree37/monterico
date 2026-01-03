"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface User {
    id: string;
    name: string;
    email: string | null;
    ratio?: number;
    isActive?: boolean;
}

interface Split {
    userId: string;
    amount: number;
}

interface CustomSplitsInputProps {
    users: User[];
    totalAmount: number;
    splits: Split[];
    onSplitsChange: (splits: Split[]) => void;
    splitType: "equal" | "ratio" | "custom";
}

export default function CustomSplitsInput({
    users,
    totalAmount,
    splits,
    onSplitsChange,
    splitType,
}: CustomSplitsInputProps) {
    // Initialize splits when users or total amount changes
    useEffect(() => {
        if (splitType === "equal") {
            const splitAmount = totalAmount / users.length;
            const newSplits = users.map((user) => ({
                userId: user.id,
                amount: splitAmount,
            }));
            onSplitsChange(newSplits);
        } else if (splitType === "ratio") {
            const totalRatio = users.reduce(
                (sum, user) => sum + (user.ratio || 1),
                0,
            );
            const newSplits = users.map((user) => ({
                userId: user.id,
                amount: (totalAmount * (user.ratio || 1)) / totalRatio,
            }));
            onSplitsChange(newSplits);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalAmount, users.length, splitType]);

    const handleSplitChange = (userId: string, amount: number) => {
        const newSplits = splits.map((split) =>
            split.userId === userId ? { ...split, amount } : split,
        );
        onSplitsChange(newSplits);
    };

    const getSplitTotal = () => {
        return splits.reduce((sum, split) => sum + split.amount, 0);
    };

    const getDifference = () => {
        return totalAmount - getSplitTotal();
    };

    if (splitType !== "custom") {
        // For equal and ratio splits, show read-only calculated values
        return (
            <div className="space-y-3">
                {users.map((user) => {
                    const split = splits.find((s) => s.userId === user.id);
                    return (
                        <div
                            key={user.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded"
                        >
                            <span className="font-medium">{user.name}</span>
                            <span className="text-sm">
                                €{split?.amount.toFixed(2) || "0.00"}
                            </span>
                        </div>
                    );
                })}
                <div className="pt-2 border-t flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span>€{getSplitTotal().toFixed(2)}</span>
                </div>
            </div>
        );
    }

    // For custom splits, show editable inputs
    return (
        <div className="space-y-3">
            {users.map((user) => {
                const split = splits.find((s) => s.userId === user.id);
                return (
                    <div key={user.id} className="space-y-1">
                        <Label>{user.name}</Label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={split?.amount || 0}
                            onChange={(e) =>
                                handleSplitChange(
                                    user.id,
                                    parseFloat(e.target.value) || 0,
                                )
                            }
                            placeholder="0.00"
                        />
                    </div>
                );
            })}
            <div className="pt-2 border-t space-y-1">
                <div className="flex items-center justify-between font-semibold">
                    <span>Total Split</span>
                    <span>€{getSplitTotal().toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span>Expense Total</span>
                    <span>€{totalAmount.toFixed(2)}</span>
                </div>
                {getDifference() !== 0 && (
                    <div
                        className={`flex items-center justify-between text-sm font-medium ${
                            getDifference() > 0
                                ? "text-red-600"
                                : "text-orange-600"
                        }`}
                    >
                        <span>Difference</span>
                        <span>€{getDifference().toFixed(2)}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
