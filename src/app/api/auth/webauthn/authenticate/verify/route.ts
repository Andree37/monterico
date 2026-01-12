import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth/config";
import { prisma } from "@/lib/db";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const ORIGIN = process.env.NEXT_PUBLIC_ORIGIN || "http://localhost:3000";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { credential, challenge } = await request.json();
        if (!credential || !challenge) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 },
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 },
            );
        }

        const credentialIdBase64url = (credential as AuthenticationResponseJSON)
            .id;

        const mfaMethods = await prisma.mFAMethod.findMany({
            where: {
                userId: user.id,
                type: "passkey",
                isActive: true,
            },
            select: {
                id: true,
                passkeyData: {
                    select: {
                        id: true,
                        credentialId: true,
                        publicKey: true,
                        counter: true,
                    },
                },
            },
        });

        const mfaMethod = mfaMethods.find(
            (method) =>
                method.passkeyData?.credentialId === credentialIdBase64url,
        );

        if (!mfaMethod || !mfaMethod.passkeyData) {
            return NextResponse.json(
                { error: "Passkey not found" },
                { status: 404 },
            );
        }

        const publicKeyBuffer = Uint8Array.from(
            Buffer.from(mfaMethod.passkeyData.publicKey, "base64url"),
        );

        const verification = await verifyAuthenticationResponse({
            response: credential as AuthenticationResponseJSON,
            expectedChallenge: challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            authenticator: {
                credentialID: mfaMethod.passkeyData.credentialId,
                credentialPublicKey: publicKeyBuffer,
                counter: mfaMethod.passkeyData.counter,
            },
        });

        if (!verification.verified) {
            return NextResponse.json(
                { error: "Verification failed" },
                { status: 400 },
            );
        }

        await prisma.passkeyData.update({
            where: { id: mfaMethod.passkeyData.id },
            data: {
                counter: verification.authenticationInfo.newCounter,
                lastUsedAt: new Date(),
            },
        });

        return NextResponse.json({ verified: true });
    } catch (error) {
        console.error("Error verifying authentication:", error);
        return NextResponse.json(
            { error: "Failed to verify authentication" },
            { status: 500 },
        );
    }
}
