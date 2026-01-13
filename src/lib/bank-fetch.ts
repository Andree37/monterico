"use client";

interface BankFetchOptions extends RequestInit {
    skipBankMfa?: boolean;
}

export class BankMfaRequiredError extends Error {
    code: string;

    constructor(message: string, code: string) {
        super(message);
        this.name = "BankMfaRequiredError";
        this.code = code;
    }
}

export async function bankFetch(
    url: string,
    options?: BankFetchOptions,
): Promise<Response> {
    const { skipBankMfa, ...fetchOptions } = options || {};

    const response = await fetch(url, fetchOptions);

    if (response.status === 403 && !skipBankMfa) {
        try {
            const data = await response.clone().json();
            if (
                data.code === "BANK_MFA_REQUIRED" ||
                data.code === "BANK_MFA_EXPIRED"
            ) {
                throw new BankMfaRequiredError(data.error, data.code);
            }
        } catch (error) {
            if (error instanceof BankMfaRequiredError) {
                throw error;
            }
        }
    }

    return response;
}

export function isBankMfaError(error: unknown): error is BankMfaRequiredError {
    return error instanceof BankMfaRequiredError;
}

export async function checkBankMfaStatus(): Promise<{
    verified: boolean;
    required: boolean;
    expired?: boolean;
    expiresAt?: number;
    remainingMs?: number;
}> {
    try {
        const response = await fetch("/api/auth/bank-mfa/status");
        if (!response.ok) {
            return { verified: false, required: true };
        }
        return await response.json();
    } catch (error) {
        console.error("Error checking bank MFA status:", error);
        return { verified: false, required: true };
    }
}
