import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth/config";
import { prisma } from "@/lib/db";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";

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

        const { credential, challenge, deviceName } = await request.json();
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

        const verification = await verifyRegistrationResponse({
            response: credential as RegistrationResponseJSON,
            expectedChallenge: challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            requireUserVerification: false,
        });

        if (!verification.verified || !verification.registrationInfo) {
            return NextResponse.json(
                { error: "Verification failed" },
                { status: 400 },
            );
        }

        const { credentialPublicKey, counter } = verification.registrationInfo;

        // Use credential.id directly as it's already in base64url format
        const credentialIdBase64url = (credential as RegistrationResponseJSON)
            .id;
        const publicKeyBase64url =
            Buffer.from(credentialPublicKey).toString("base64url");

        const transports = credential.response?.transports
            ? JSON.stringify(credential.response.transports)
            : null;

        const mfaMethod = await prisma.mFAMethod.create({
            data: {
                userId: user.id,
                type: "passkey",
                name: deviceName || "Passkey",
                isActive: true,
                passkeyData: {
                    create: {
                        credentialId: credentialIdBase64url,
                        publicKey: publicKeyBase64url,
                        counter: counter,
                        transports: transports,
                    },
                },
            },
        });

        await prisma.user.update({
            where: { id: user.id },
            data: { mfaSetupComplete: true },
        });

        return NextResponse.json({
            verified: true,
            mfaMethodId: mfaMethod.id,
        });
    } catch (error) {
        console.error("Error verifying registration:", error);
        return NextResponse.json(
            { error: "Failed to verify registration" },
            { status: 500 },
        );
    }
}
