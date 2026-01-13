import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/session";

export async function GET() {
    try {
        const { userId } = await getAuthenticatedUser();

        const configs = await prisma.householdMemberAllowanceConfig.findMany({
            where: {
                householdMember: {
                    userId,
                },
            },
            include: {
                householdMember: true,
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
        console.error(
            "Error fetching household member allowance configs:",
            error,
        );
        return NextResponse.json(
            { success: false, error: "Failed to fetch configs" },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const { userId } = await getAuthenticatedUser();
        const body = await request.json();
        const { householdMemberId, type, value } = body;

        if (!householdMemberId || !type || value === undefined) {
            return NextResponse.json(
                {
                    success: false,
                    error: "householdMemberId, type, and value are required",
                },
                { status: 400 },
            );
        }

        // Verify the household member belongs to this user
        const member = await prisma.householdMember.findFirst({
            where: {
                id: householdMemberId,
                userId,
            },
        });

        if (!member) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Household member not found or unauthorized",
                },
                { status: 404 },
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

        const config = await prisma.householdMemberAllowanceConfig.upsert({
            where: { householdMemberId },
            update: {
                type,
                value,
                isActive: true,
            },
            create: {
                householdMemberId,
                type,
                value,
                isActive: true,
            },
            include: {
                householdMember: true,
            },
        });

        return NextResponse.json({
            success: true,
            config,
        });
    } catch (error) {
        console.error(
            "Error updating household member allowance config:",
            error,
        );
        return NextResponse.json(
            { success: false, error: "Failed to update config" },
            { status: 500 },
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const { userId } = await getAuthenticatedUser();
        const { searchParams } = new URL(request.url);
        const householdMemberId = searchParams.get("householdMemberId");

        if (!householdMemberId) {
            return NextResponse.json(
                { success: false, error: "householdMemberId is required" },
                { status: 400 },
            );
        }

        // Verify the household member belongs to this user
        const member = await prisma.householdMember.findFirst({
            where: {
                id: householdMemberId,
                userId,
            },
        });

        if (!member) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Household member not found or unauthorized",
                },
                { status: 404 },
            );
        }

        await prisma.householdMemberAllowanceConfig.delete({
            where: { householdMemberId },
        });

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error(
            "Error deleting household member allowance config:",
            error,
        );
        return NextResponse.json(
            { success: false, error: "Failed to delete config" },
            { status: 500 },
        );
    }
}
