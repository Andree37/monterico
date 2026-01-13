"use client";

import { useState, useCallback } from "react";

export function useBankMfa() {
    const [showMfaDialog, setShowMfaDialog] = useState(false);
    const [pendingOperation, setPendingOperation] = useState<
        (() => Promise<void>) | null
    >(null);

    const checkBankMfa = useCallback(async () => {
        try {
            const response = await fetch("/api/auth/bank-mfa/status");
            if (!response.ok) {
                return { verified: false, required: true };
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error checking bank MFA status:", error);
            return { verified: false, required: true };
        }
    }, []);

    const executeBankOperation = useCallback(
        async <T>(operation: () => Promise<T>): Promise<T> => {
            try {
                const result = await operation();
                return result;
            } catch (error: unknown) {
                const err = error as { code?: string; message?: string };
                if (
                    err?.code === "BANK_MFA_REQUIRED" ||
                    err?.code === "BANK_MFA_EXPIRED" ||
                    (err?.message &&
                        (err.message.includes("Bank operation MFA") ||
                            err.message.includes("bank operation")))
                ) {
                    return new Promise<T>((resolve, reject) => {
                        setPendingOperation(() => async () => {
                            try {
                                const result = await operation();
                                resolve(result);
                            } catch (err) {
                                reject(err);
                            }
                        });
                        setShowMfaDialog(true);
                    });
                }
                throw error;
            }
        },
        [],
    );

    const handleMfaSuccess = useCallback(() => {
        if (pendingOperation) {
            pendingOperation();
            setPendingOperation(null);
        }
        setShowMfaDialog(false);
    }, [pendingOperation]);

    const handleMfaCancel = useCallback(() => {
        setPendingOperation(null);
        setShowMfaDialog(false);
    }, []);

    return {
        showMfaDialog,
        setShowMfaDialog,
        checkBankMfa,
        executeBankOperation,
        handleMfaSuccess,
        handleMfaCancel,
    };
}
