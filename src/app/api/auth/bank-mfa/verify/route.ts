import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";

const rpID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const expectedOrigin =
    process.env.NEXT_PUBLIC_ORIGIN || "https://localhost:3000";

// Bank operation MFA is valid for 15 minutes
const BANK_MFA_VALIDITY_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
    try {
        const { userId } = await getAuthenticatedUser();
        const body = await request.json();
        const { method, credential, challenge } = body;

        if (!method) {
            return NextResponse.json(
                { error: "MFA method required" },
                { status: 400 },
            );
        }

        let verified = false;

        if (method === "webauthn" || method === "passkey") {
            if (!credential || !challenge) {
                return NextResponse.json(
                    { error: "WebAuthn credential and challenge required" },
                    { status: 400 },
                );
            }

            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                return NextResponse.json(
                    { error: "User not found" },
                    { status: 404 },
                );
            }

            const mfaMethod = await prisma.mFAMethod.findFirst({
                where: {
                    userId,
                    type: "passkey",
                    isActive: true,
                },
                include: {
                    passkeyData: true,
                },
            });

            if (!mfaMethod || !mfaMethod.passkeyData) {
                return NextResponse.json(
                    { error: "WebAuthn method not found" },
                    { status: 404 },
                );
            }

            const publicKeyBuffer = Uint8Array.from(
                Buffer.from(mfaMethod.passkeyData.publicKey, "base64url"),
            );

            const verification = await verifyAuthenticationResponse({
                response: credential as AuthenticationResponseJSON,
                expectedChallenge: challenge,
                expectedOrigin,
                expectedRPID: rpID,
                authenticator: {
                    credentialID: mfaMethod.passkeyData.credentialId,
                    credentialPublicKey: publicKeyBuffer,
                    counter: mfaMethod.passkeyData.counter || 0,
                },
            });

            verified = verification.verified;

            if (verified) {
                await prisma.passkeyData.update({
                    where: { id: mfaMethod.passkeyData.id },
                    data: {
                        counter: verification.authenticationInfo.newCounter,
                        lastUsedAt: new Date(),
                    },
                });
            }
        } else {
            return NextResponse.json(
                {
                    error: "Invalid MFA method. Only webauthn/passkey is currently supported for bank operations.",
                },
                { status: 400 },
            );
        }

        if (!verified) {
            return NextResponse.json(
                { error: "MFA verification failed" },
                { status: 401 },
            );
        }

        // Return success with a flag to update session on client
        return NextResponse.json({
            success: true,
            verified: true,
            expiresIn: BANK_MFA_VALIDITY_MS,
            updateSession: true,
            bankOperationMfaVerifiedAt: Date.now(),
        });
    } catch (error) {
        console.error("Error verifying bank operation MFA:", error);
        const message =
            error instanceof Error ? error.message : "Verification failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
