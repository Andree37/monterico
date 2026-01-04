import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { CountryCode } from "plaid";

export async function POST(request: NextRequest) {
    try {
        const { publicToken } = await request.json();

        if (!publicToken) {
            return NextResponse.json(
                { error: "Missing public token" },
                { status: 400 },
            );
        }

        const response = await plaidClient.itemPublicTokenExchange({
            public_token: publicToken,
        });

        const accessToken = response.data.access_token;
        const itemId = response.data.item_id;

        const itemResponse = await plaidClient.itemGet({
            access_token: accessToken,
        });

        const institutionId = itemResponse.data.item.institution_id;
        let institutionName = null;

        if (institutionId) {
            try {
                const institutionResponse =
                    await plaidClient.institutionsGetById({
                        institution_id: institutionId,
                        country_codes: [CountryCode.Ie, CountryCode.Gb],
                    });
                institutionName = institutionResponse.data.institution.name;
            } catch (error) {
                console.error("Error fetching institution:", error);
            }
        }

        const bankConnection = await prisma.bankConnection.create({
            data: {
                userId: undefined,
                itemId: itemId,
                accessToken: accessToken,
                institutionId: institutionId || null,
                institutionName: institutionName,
                status: "active",
            },
        });

        const accountsResponse = await plaidClient.accountsGet({
            access_token: accessToken,
        });

        const accounts = await Promise.all(
            accountsResponse.data.accounts.map(async (acc) => {
                return await prisma.account.create({
                    data: {
                        bankConnectionId: bankConnection.id,
                        accountId: acc.account_id,
                        name: acc.name,
                        officialName: acc.official_name || null,
                        type: acc.type,
                        subtype: acc.subtype || null,
                        currentBalance: acc.balances.current,
                        availableBalance: acc.balances.available,
                        currency: acc.balances.iso_currency_code || null,
                    },
                });
            }),
        );

        return NextResponse.json({
            success: true,
            bankConnectionId: bankConnection.id,
            itemId: itemId,
            institutionName: institutionName,
            accountCount: accounts.length,
        });
    } catch (error: unknown) {
        console.error("Error exchanging public token:", error);
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
