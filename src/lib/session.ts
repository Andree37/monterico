import { auth } from "@/auth/config";

// Bank operation MFA is valid for 15 minutes
const BANK_MFA_VALIDITY_MS = 15 * 60 * 1000;

export async function getAuthenticatedUser() {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    return {
        userId: session.user.id,
        email: session.user.email,
        mfaVerified: session.user.mfaVerified,
        mfaRequired: session.user.mfaRequired,
        mfaSetupComplete: session.user.mfaSetupComplete,
    };
}

export async function getSession() {
    return await auth();
}

export async function requireBankOperationMfa() {
    const session = await auth();

    if (!session?.user?.id) {
        return {
            error: "Unauthorized",
            status: 401 as const,
        };
    }

    const bankOperationMfaVerifiedAt = session.user.bankOperationMfaVerifiedAt;

    if (!bankOperationMfaVerifiedAt) {
        return {
            error: "Bank operation MFA verification required",
            status: 403 as const,
            code: "BANK_MFA_REQUIRED" as const,
        };
    }

    const now = Date.now();
    const isValid = now - bankOperationMfaVerifiedAt < BANK_MFA_VALIDITY_MS;

    if (!isValid) {
        return {
            error: "Bank operation MFA verification expired",
            status: 403 as const,
            code: "BANK_MFA_EXPIRED" as const,
        };
    }

    return {
        success: true as const,
        userId: session.user.id,
        email: session.user.email,
    };
}
