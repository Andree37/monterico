import { NextRequest, NextResponse } from "next/server";
import { createEnableBankingClient } from "@/lib/enablebanking/client";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const country = searchParams.get("country") || "IE";
        const psuType = searchParams.get("psu_type") || "personal";

        const client = createEnableBankingClient();
        const aspsps = await client.getASPSPs(country, psuType);

        const banks = aspsps.map((aspsp) => ({
            id: aspsp.name,
            name: aspsp.name,
            country: aspsp.country,
            psuTypes: aspsp.psu_type,
            services: aspsp.services,
        }));

        return NextResponse.json({ banks });
    } catch (error) {
        console.error("Enable Banking get banks error:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch banks",
            },
            { status: 500 },
        );
    }
}
