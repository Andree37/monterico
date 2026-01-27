import { NextRequest, NextResponse } from "next/server";
import { createEnableBankingClient } from "@/lib/enablebanking/client";
import { requireBankOperationMfa } from "@/lib/session";

export async function POST(request: NextRequest) {
    try {
        const mfaCheck = await requireBankOperationMfa();
        if ("error" in mfaCheck) {
            return NextResponse.json(
                { error: mfaCheck.error, code: mfaCheck.code },
                { status: mfaCheck.status },
            );
        }

        const { userId } = mfaCheck;
        const { aspsp, psuType } = await request.json();

        if (!aspsp) {
            return NextResponse.json(
                { error: "Missing required field: aspsp (bank name)" },
                { status: 400 },
            );
        }

        const client = createEnableBankingClient();

        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 90);

        const state = userId;

        const authResponse = await client.startAuth({
            access: {
                valid_until: validUntil.toISOString(),
            },
            aspsp: {
                name: aspsp,
                country: "IE",
            },
            state,
            redirect_url:
                process.env.ENABLE_BANKING_REDIRECT_URL || "WOMP WOMP",
            psu_type: psuType || "personal",
        });

        // Store session_id in a way that can be retrieved during callback
        // For now, return it to the frontend to include in the redirect
        return NextResponse.json({
            url: authResponse.url,
            session_id: authResponse.session_id,
            state,
        });
    } catch (error) {
        console.error("Enable Banking auth error:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to start auth",
            },
            { status: 500 },
        );
    }
}
