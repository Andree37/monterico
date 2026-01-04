import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET all users with their split ratios
export async function GET() {
    try {
        const users = await prisma.user.findMany({
            orderBy: {
                createdAt: "asc",
            },
        });

        // Get split ratios for each user
        const usersWithRatios = await Promise.all(
            users.map(async (user) => {
                const splitRatio = await prisma.userSplitRatio.findUnique({
                    where: { userId: user.id },
                });

                return {
                    ...user,
                    ratio: splitRatio?.ratio || 0.5,
                    isActive: splitRatio?.isActive ?? true,
                };
            }),
        );

        return NextResponse.json(usersWithRatios);
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json(
            { error: "Failed to fetch users" },
            { status: 500 },
        );
    }
}

// POST - Create a new user
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email, ratio } = body;

        if (!name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 },
            );
        }

        // Create user and their split ratio in a transaction
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name,
                    email: email || null,
                },
            });

            // Create split ratio for the user
            await tx.userSplitRatio.create({
                data: {
                    userId: user.id,
                    ratio: ratio !== undefined ? parseFloat(ratio) : 0.5,
                    isActive: true,
                },
            });

            return user;
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error creating user:", error);
        return NextResponse.json(
            { error: "Failed to create user" },
            { status: 500 },
        );
    }
}

// PATCH - Update user details or ratio
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, name, email, ratio, isActive } = body;

        if (!id) {
            return NextResponse.json(
                { error: "User ID is required" },
                { status: 400 },
            );
        }

        // Update user and their split ratio in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update user basic info
            const updateData: { name?: string; email?: string | null } = {};
            if (name !== undefined) updateData.name = name;
            if (email !== undefined) updateData.email = email || null;

            let user;
            if (Object.keys(updateData).length > 0) {
                user = await tx.user.update({
                    where: { id },
                    data: updateData,
                });
            } else {
                user = await tx.user.findUnique({ where: { id } });
            }

            // Update or create split ratio
            if (ratio !== undefined || isActive !== undefined) {
                const splitRatioData: { ratio?: number; isActive?: boolean } =
                    {};
                if (ratio !== undefined)
                    splitRatioData.ratio = parseFloat(ratio);
                if (isActive !== undefined) splitRatioData.isActive = isActive;

                await tx.userSplitRatio.upsert({
                    where: { userId: id },
                    update: splitRatioData,
                    create: {
                        userId: id,
                        ratio: ratio !== undefined ? parseFloat(ratio) : 0.5,
                        isActive: isActive !== undefined ? isActive : true,
                    },
                });
            }

            return user;
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error updating user:", error);
        return NextResponse.json(
            { error: "Failed to update user" },
            { status: 500 },
        );
    }
}

// DELETE - Delete a user (soft delete by setting isActive to false)
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "User ID is required" },
                { status: 400 },
            );
        }

        // Soft delete - set isActive to false
        await prisma.userSplitRatio.upsert({
            where: { userId: id },
            update: { isActive: false },
            create: {
                userId: id,
                ratio: 0.5,
                isActive: false,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting user:", error);

        // Return more detailed error message
        const errorMessage =
            error instanceof Error ? error.message : "Failed to delete user";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
