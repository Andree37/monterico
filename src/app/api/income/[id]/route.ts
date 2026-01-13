import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/session";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { userId } = await getAuthenticatedUser();
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: "Missing income ID" },
                { status: 400 },
            );
        }

        // Verify the income belongs to the current user
        const income = await prisma.income.findUnique({
            where: { id },
        });

        if (!income) {
            return NextResponse.json(
                { error: "Income not found" },
                { status: 404 },
            );
        }

        if (income.userId !== userId) {
            return NextResponse.json(
                { error: "Unauthorized to delete this income" },
                { status: 403 },
            );
        }

        await prisma.income.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "Income deleted",
        });
    } catch (error: unknown) {
        console.error("Error deleting income:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
