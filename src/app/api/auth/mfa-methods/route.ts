import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const { userId } = await getAuthenticatedUser();

        const mfaMethods = await prisma.mFAMethod.findMany({
            where: {
                userId,
                isActive: true,
            },
            select: {
                id: true,
                type: true,
                name: true,
                createdAt: true,
                passkeyData: {
                    select: {
                        lastUsedAt: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return NextResponse.json({
            success: true,
            methods: mfaMethods,
        });
    } catch (error) {
        console.error("Error fetching MFA methods:", error);
        return NextResponse.json(
            { error: "Failed to fetch MFA methods" },
            { status: 500 },
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { userId } = await getAuthenticatedUser();

        const { methodId } = await request.json();
        if (!methodId) {
            return NextResponse.json(
                { error: "Method ID required" },
                { status: 400 },
            );
        }

        // Check if this is the last MFA method
        const remainingMethods = await prisma.mFAMethod.count({
            where: {
                userId,
                isActive: true,
            },
        });

        if (remainingMethods <= 1) {
            return NextResponse.json(
                { error: "Cannot delete last MFA method" },
                { status: 400 },
            );
        }

        // Verify the method belongs to the user
        const method = await prisma.mFAMethod.findFirst({
            where: {
                id: methodId,
                userId,
            },
        });

        if (!method) {
            return NextResponse.json(
                { error: "MFA method not found" },
                { status: 404 },
            );
        }

        // Soft delete by marking as inactive
        await prisma.mFAMethod.update({
            where: { id: methodId },
            data: { isActive: false },
        });

        return NextResponse.json({
            success: true,
            message: "MFA method removed",
        });
    } catch (error) {
        console.error("Error deleting MFA method:", error);
        return NextResponse.json(
            { error: "Failed to delete MFA method" },
            { status: 500 },
        );
    }
}
