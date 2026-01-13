import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSession } from "@/lib/session";

// Bank operation MFA is valid for 15 minutes
const BANK_MFA_VALIDITY_MS = 15 * 60 * 1000;

export async function GET() {
    try {
        await getAuthenticatedUser();
        const session = await getSession();

        const bankOperationMfaVerifiedAt =
            session?.user?.bankOperationMfaVerifiedAt;

        if (!bankOperationMfaVerifiedAt) {
            return NextResponse.json({
                verified: false,
                required: true,
            });
        }

        const now = Date.now();
        const isValid = now - bankOperationMfaVerifiedAt < BANK_MFA_VALIDITY_MS;

        if (!isValid) {
            return NextResponse.json({
                verified: false,
                required: true,
                expired: true,
            });
        }

        const expiresAt = bankOperationMfaVerifiedAt + BANK_MFA_VALIDITY_MS;
        const remainingMs = expiresAt - now;

        return NextResponse.json({
            verified: true,
            required: false,
            expiresAt,
            remainingMs,
        });
    } catch (error) {
        console.error("Error checking bank operation MFA status:", error);
        const message =
            error instanceof Error ? error.message : "Failed to check status";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
