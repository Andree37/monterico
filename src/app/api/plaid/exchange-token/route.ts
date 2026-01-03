import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
        const { publicToken, userId } = await request.json();

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
                        country_codes: ["IE", "GB"],
                    });
                institutionName = institutionResponse.data.institution.name;
            } catch (error) {
                console.error("Error fetching institution:", error);
            }
        }

        const user = await prisma.user.upsert({
            where: { id: userId || "default_user" },
            update: {},
            create: {
                id: userId || "default_user",
                name: "Default User",
            },
        });

        const bankConnection = await prisma.bankConnection.create({
            data: {
                userId: user.id,
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
    } catch (error: any) {
        console.error("Error exchanging public token:", error);
        return NextResponse.json(
            { error: error.response?.data || error.message },
            { status: 500 },
        );
    }
}
