import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        // Get the first (and should be only) settings record
        let settings = await prisma.settings.findFirst();

        // If no settings exist, create default ones
        if (!settings) {
            settings = await prisma.settings.create({
                data: {
                    defaultPaidBy: null,
                    defaultType: "shared",
                    defaultSplitType: "equal",
                },
            });
        }

        return NextResponse.json({
            success: true,
            settings,
        });
    } catch (error: unknown) {
        console.error("Error fetching settings:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { defaultPaidBy, defaultType, defaultSplitType } = body;

        // Get existing settings or create if none exist
        let settings = await prisma.settings.findFirst();

        if (settings) {
            // Update existing settings
            settings = await prisma.settings.update({
                where: { id: settings.id },
                data: {
                    defaultPaidBy:
                        defaultPaidBy !== undefined
                            ? defaultPaidBy
                            : settings.defaultPaidBy,
                    defaultType: defaultType || settings.defaultType,
                    defaultSplitType:
                        defaultSplitType || settings.defaultSplitType,
                },
            });
        } else {
            // Create new settings
            settings = await prisma.settings.create({
                data: {
                    defaultPaidBy: defaultPaidBy || null,
                    defaultType: defaultType || "shared",
                    defaultSplitType: defaultSplitType || "equal",
                },
            });
        }

        return NextResponse.json({
            success: true,
            settings,
        });
    } catch (error: unknown) {
        console.error("Error saving settings:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
