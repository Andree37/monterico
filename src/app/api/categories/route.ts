import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth/config";

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const userId = session.user.id;

        const categories = await prisma.category.findMany({
            where: { userId },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({
            success: true,
            categories,
            count: categories.length,
        });
    } catch (error: unknown) {
        console.error("Error fetching categories:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const body = await request.json();
        const { name, description, color, icon } = body;

        const category = await prisma.category.create({
            data: {
                userId,
                name,
                description,
                color,
                icon,
            },
        });

        return NextResponse.json({
            success: true,
            category,
        });
    } catch (error: unknown) {
        console.error("Error creating category:", error);
        const message =
            error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
