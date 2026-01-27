import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/session";

export async function GET() {
    try {
        const { userId } = await getAuthenticatedUser();

        const householdMembers = await prisma.householdMember.findMany({
            where: { userId },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({
            success: true,
            householdMembers,
        });
    } catch (error) {
        console.error("Error fetching household members:", error);
        return NextResponse.json(
            { error: "Failed to fetch household members" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const { userId } = await getAuthenticatedUser();
        const body = await request.json();

        const { name } = body;

        if (!name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 }
            );
        }

        const householdMember = await prisma.householdMember.create({
            data: {
                userId,
                name,
                isActive: true,
            },
        });

        return NextResponse.json({
            success: true,
            householdMember,
        });
    } catch (error) {
        console.error("Error creating household member:", error);
        return NextResponse.json(
            { error: "Failed to create household member" },
            { status: 500 }
        );
    }
}
