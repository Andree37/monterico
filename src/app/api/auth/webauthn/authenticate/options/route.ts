import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth/config";
import { prisma } from "@/lib/db";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || "localhost";

export async function POST(_request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
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

        const passkeys = await prisma.mFAMethod.findMany({
            where: {
                userId: user.id,
                type: "passkey",
                isActive: true,
            },
        });

        if (passkeys.length === 0) {
            return NextResponse.json(
                { error: "No passkeys registered" },
                { status: 400 },
            );
        }

        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            userVerification: "required",
        });

        return NextResponse.json({
            options,
            challenge: options.challenge,
        });
    } catch (error) {
        console.error("Error generating authentication options:", error);
        return NextResponse.json(
            { error: "Failed to generate authentication options" },
            { status: 500 },
        );
    }
}
