import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { generateRegistrationOptions } from "@simplewebauthn/server";

const RP_NAME = "Monterico";
const RP_ID = process.env.NEXT_PUBLIC_RP_ID || "localhost";

export async function POST(_request: NextRequest) {
    try {
        const { userId } = await getAuthenticatedUser();

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 },
            );
        }

        const existingPasskeys = await prisma.mFAMethod.findMany({
            where: {
                userId: user.id,
                type: "passkey",
                isActive: true,
            },
            select: {
                passkeyData: {
                    select: {
                        credentialId: true,
                        transports: true,
                    },
                },
            },
        });

        const excludeCredentials = existingPasskeys
            .filter((method) => method.passkeyData)
            .map((method) => ({
                id: method.passkeyData!.credentialId,
                type: "public-key" as const,
                transports: method.passkeyData!.transports
                    ? JSON.parse(method.passkeyData!.transports)
                    : undefined,
            }));

        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: RP_ID,
            userID: new TextEncoder().encode(user.id),
            userName: user.email || "",
            userDisplayName: user.email,
            attestationType: "none",
            excludeCredentials,
            authenticatorSelection: {
                residentKey: "required",
                userVerification: "required",
                authenticatorAttachment: "platform",
            },
        });

        return NextResponse.json({
            options,
            challenge: options.challenge,
        });
    } catch (error) {
        console.error("Error generating registration options:", error);
        return NextResponse.json(
            { error: "Failed to generate registration options" },
            { status: 500 },
        );
    }
}
