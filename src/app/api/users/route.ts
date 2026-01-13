import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/session";

// GET all household members for a user
export async function GET() {
    try {
        const { userId } = await getAuthenticatedUser();

        const members = await prisma.householdMember.findMany({
            where: {
                userId,
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        // Get split ratios for each member
        const membersWithRatios = await Promise.all(
            members.map(async (member) => {
                const splitRatio =
                    await prisma.householdMemberSplitRatio.findUnique({
                        where: { householdMemberId: member.id },
                    });

                return {
                    ...member,
                    ratio: splitRatio?.ratio || 0.5,
                };
            }),
        );

        return NextResponse.json(membersWithRatios);
    } catch (error) {
        console.error("Error fetching household members:", error);
        return NextResponse.json(
            { error: "Failed to fetch household members" },
            { status: 500 },
        );
    }
}

// POST - Create a new household member
export async function POST(request: Request) {
    try {
        const { userId } = await getAuthenticatedUser();
        const body = await request.json();
        const { name, ratio } = body;

        if (!name) {
            return NextResponse.json(
                { error: "name is required" },
                { status: 400 },
            );
        }

        const result = await prisma.$transaction(async (tx) => {
            const member = await tx.householdMember.create({
                data: {
                    userId,
                    name,
                    isActive: true,
                },
            });

            // Create split ratio for the member
            await tx.householdMemberSplitRatio.create({
                data: {
                    householdMemberId: member.id,
                    ratio: ratio !== undefined ? parseFloat(ratio) : 0.5,
                    isActive: true,
                },
            });

            return member;
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error creating household member:", error);
        return NextResponse.json(
            { error: "Failed to create household member" },
            { status: 500 },
        );
    }
}

// PATCH - Update household member details or ratio
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, name, ratio, isActive } = body;

        if (!id) {
            return NextResponse.json(
                { error: "Household member ID is required" },
                { status: 400 },
            );
        }

        // Update member and their split ratio in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update member basic info
            const updateData: { name?: string; isActive?: boolean } = {};
            if (name !== undefined) updateData.name = name;
            if (isActive !== undefined) updateData.isActive = isActive;

            let member;
            if (Object.keys(updateData).length > 0) {
                member = await tx.householdMember.update({
                    where: { id },
                    data: updateData,
                });
            } else {
                member = await tx.householdMember.findUnique({ where: { id } });
            }

            // Update or create split ratio
            if (ratio !== undefined) {
                await tx.householdMemberSplitRatio.upsert({
                    where: { householdMemberId: id },
                    update: { ratio: parseFloat(ratio) },
                    create: {
                        householdMemberId: id,
                        ratio: parseFloat(ratio),
                        isActive: true,
                    },
                });
            }

            return member;
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error updating household member:", error);
        return NextResponse.json(
            { error: "Failed to update household member" },
            { status: 500 },
        );
    }
}

// DELETE - Delete a household member (soft delete by setting isActive to false)
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Household member ID is required" },
                { status: 400 },
            );
        }

        // Soft delete - set isActive to false
        await prisma.householdMember.update({
            where: { id },
            data: { isActive: false },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting household member:", error);

        const errorMessage =
            error instanceof Error
                ? error.message
                : "Failed to delete household member";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
