import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const configs = await prisma.userAllowanceConfig.findMany({
            include: {
                user: true,
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        return NextResponse.json({
            success: true,
            configs,
        });
    } catch (error) {
        console.error("Error fetching user allowance configs:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch configs" },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, type, value } = body;

        if (!userId || !type || value === undefined) {
            return NextResponse.json(
                {
                    success: false,
                    error: "userId, type, and value are required",
                },
                { status: 400 },
            );
        }

        if (type !== "percentage" && type !== "fixed") {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Type must be "percentage" or "fixed"',
                },
                { status: 400 },
            );
        }

        if (type === "percentage" && (value < 0 || value > 1)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Percentage value must be between 0 and 1",
                },
                { status: 400 },
            );
        }

        if (type === "fixed" && value < 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Fixed value must be positive",
                },
                { status: 400 },
            );
        }

        const config = await prisma.userAllowanceConfig.upsert({
            where: { userId },
            update: {
                type,
                value,
                isActive: true,
            },
            create: {
                userId,
                type,
                value,
                isActive: true,
            },
            include: {
                user: true,
            },
        });

        return NextResponse.json({
            success: true,
            config,
        });
    } catch (error) {
        console.error("Error updating user allowance config:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update config" },
            { status: 500 },
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json(
                { success: false, error: "userId is required" },
                { status: 400 },
            );
        }

        await prisma.userAllowanceConfig.delete({
            where: { userId },
        });

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error("Error deleting user allowance config:", error);
        return NextResponse.json(
            { success: false, error: "Failed to delete config" },
            { status: 500 },
        );
    }
}
