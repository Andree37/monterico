import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

export async function POST(request: NextRequest) {
    try {
        const { userId } = await request.json();

        const response = await plaidClient.linkTokenCreate({
            user: {
                client_user_id: userId || "user_" + Date.now(),
            },
            client_name: "Monterico Banking App",
            products: [Products.Transactions],
            country_codes: [CountryCode.Ie, CountryCode.Gb],
            language: "en",
        });

        return NextResponse.json({
            link_token: response.data.link_token,
            expiration: response.data.expiration,
        });
    } catch (error: unknown) {
        console.error("Error creating link token:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        const responseData = (error as { response?: { data?: unknown } })
            .response?.data;
        return NextResponse.json(
            { error: responseData || message },
            { status: 500 },
        );
    }
}
