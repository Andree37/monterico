import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        // Get the first (and should be only) settings record
        let settings = await prisma.settings.findFirst();

        // If no settings exist, create default ones
        if (!settings) {
            settings = await prisma.settings.create({
                data: {
                    defaultAndreRatio: 0.5,
                    defaultRitaRatio: 0.5,
                    defaultPaidBy: "andre",
                    defaultType: "shared",
                },
            });
        }

        return NextResponse.json({
            success: true,
            settings,
        });
    } catch (error: any) {
        console.error("Error fetching settings:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            defaultAndreRatio,
            defaultRitaRatio,
            defaultPaidBy,
            defaultType,
        } = body;

        // Get existing settings or create if none exist
        let settings = await prisma.settings.findFirst();

        if (settings) {
            // Update existing settings
            settings = await prisma.settings.update({
                where: { id: settings.id },
                data: {
                    defaultAndreRatio:
                        defaultAndreRatio !== undefined
                            ? parseFloat(defaultAndreRatio)
                            : settings.defaultAndreRatio,
                    defaultRitaRatio:
                        defaultRitaRatio !== undefined
                            ? parseFloat(defaultRitaRatio)
                            : settings.defaultRitaRatio,
                    defaultPaidBy: defaultPaidBy || settings.defaultPaidBy,
                    defaultType: defaultType || settings.defaultType,
                },
            });
        } else {
            // Create new settings
            settings = await prisma.settings.create({
                data: {
                    defaultAndreRatio: parseFloat(defaultAndreRatio) || 0.5,
                    defaultRitaRatio: parseFloat(defaultRitaRatio) || 0.5,
                    defaultPaidBy: defaultPaidBy || "andre",
                    defaultType: defaultType || "shared",
                },
            });
        }

        return NextResponse.json({
            success: true,
            settings,
        });
    } catch (error: any) {
        console.error("Error saving settings:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
