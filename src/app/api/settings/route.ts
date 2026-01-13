import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/session";

/**
 * GET - Fetch current user's settings
 * Returns accountingMode and userSettings for the authenticated user
 */
export async function GET() {
    try {
        const { userId } = await getAuthenticatedUser();

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                accountingMode: true,
                userSettings: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 },
            );
        }

        // Create default user settings if they don't exist
        let userSettings = user.userSettings;
        if (!userSettings) {
            userSettings = await prisma.userSettings.create({
                data: {
                    userId: user.id,
                    defaultType: "shared",
                    defaultSplitType: "equal",
                },
            });
        }

        return NextResponse.json({
            success: true,
            accountingMode: user.accountingMode,
            userSettings: {
                defaultType: userSettings.defaultType,
                defaultSplitType: userSettings.defaultSplitType,
            },
        });
    } catch (error: unknown) {
        console.error("Error fetching settings:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * POST - Update user settings
 * Updates accountingMode and/or userSettings for the authenticated user
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await getAuthenticatedUser();

        const body = await request.json();
        const { accountingMode, defaultType, defaultSplitType } = body;

        // Update accounting mode if provided
        if (accountingMode !== undefined) {
            await prisma.user.update({
                where: { id: userId },
                data: { accountingMode },
            });
        }

        // Update user settings if provided
        if (defaultType !== undefined || defaultSplitType !== undefined) {
            const updateData: {
                defaultType?: string;
                defaultSplitType?: string;
            } = {};
            if (defaultType !== undefined) updateData.defaultType = defaultType;
            if (defaultSplitType !== undefined)
                updateData.defaultSplitType = defaultSplitType;

            await prisma.userSettings.upsert({
                where: { userId },
                update: updateData,
                create: {
                    userId,
                    defaultType: defaultType || "shared",
                    defaultSplitType: defaultSplitType || "equal",
                },
            });
        }

        // Fetch updated settings
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                accountingMode: true,
                userSettings: true,
            },
        });

        return NextResponse.json({
            success: true,
            accountingMode: user?.accountingMode,
            userSettings: user?.userSettings,
        });
    } catch (error: unknown) {
        console.error("Error saving settings:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
