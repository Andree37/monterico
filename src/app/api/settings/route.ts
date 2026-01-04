import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processIncomeForSharedPool } from "@/lib/accounting/shared-pool";

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
                    accountingMode: "individual",
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
        const { defaultPaidBy, defaultType, defaultSplitType, accountingMode } =
            body;

        // Get existing settings or create if none exist
        let settings = await prisma.settings.findFirst();
        const previousMode = settings?.accountingMode || "individual";

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
                    accountingMode: accountingMode || settings.accountingMode,
                },
            });
        } else {
            // Create new settings
            settings = await prisma.settings.create({
                data: {
                    defaultPaidBy: defaultPaidBy || null,
                    defaultType: defaultType || "shared",
                    defaultSplitType: defaultSplitType || "equal",
                    accountingMode: accountingMode || "individual",
                },
            });
        }

        // Initialize shared pool if switching from individual to shared_pool
        if (previousMode === "individual" && accountingMode === "shared_pool") {
            // Get all existing income and process it through the pool
            const allIncome = await prisma.income.findMany({
                orderBy: { date: "asc" },
            });

            for (const income of allIncome) {
                await processIncomeForSharedPool(
                    income.userId,
                    income.amount,
                    new Date(income.date),
                    income.allocatedToMonth || undefined,
                );
            }
        }

        const response: {
            success: boolean;
            settings: typeof settings;
            message?: string;
            poolInitialized?: boolean;
        } = {
            success: true,
            settings,
        };

        // Add message if pool was initialized
        if (previousMode === "individual" && accountingMode === "shared_pool") {
            response.message =
                "Shared pool initialized with existing income data";
            response.poolInitialized = true;
        }

        return NextResponse.json(response);
    } catch (error: unknown) {
        console.error("Error saving settings:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
