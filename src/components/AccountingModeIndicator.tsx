"use client";

import { useAccountingMode } from "@/hooks/use-accounting-mode";
import { AlertCircle, Wallet, Users } from "lucide-react";

export function AccountingModeIndicator() {
    const { accountingMode, loading } = useAccountingMode();

    if (loading) {
        return null;
    }

    if (accountingMode === "shared_pool") {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
                <Wallet className="h-5 w-5 text-blue-600 shrink-0" />
                <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">
                        Shared Pool Mode
                    </p>
                    <p className="text-xs text-blue-700">
                        Expenses are tracked with pool balance and personal
                        allowances
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center gap-3">
            <Users className="h-5 w-5 text-purple-600 shrink-0" />
            <div className="flex-1">
                <p className="text-sm font-medium text-purple-900">
                    Individual Accounts Mode
                </p>
                <p className="text-xs text-purple-700">
                    Expenses are split and tracked as debts between people
                </p>
            </div>
        </div>
    );
}

export function AccountingModeWarning({
    requiredMode,
}: {
    requiredMode: "individual" | "shared_pool";
}) {
    const { accountingMode } = useAccountingMode();

    if (accountingMode === requiredMode) {
        return null;
    }

    const modeName =
        requiredMode === "shared_pool" ? "Shared Pool" : "Individual Accounts";

    return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
            <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900">
                    This feature requires {modeName} mode
                </p>
                <p className="text-xs text-yellow-700">
                    Please switch to {modeName} mode in Settings to use this
                    feature.
                </p>
            </div>
        </div>
    );
}
