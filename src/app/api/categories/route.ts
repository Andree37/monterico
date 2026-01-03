import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: "asc" },
        });

        return NextResponse.json({
            success: true,
            categories,
            count: categories.length,
        });
    } catch (error: any) {
        console.error("Error fetching categories:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, description, color, icon } = body;

        const category = await prisma.category.create({
            data: {
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
    } catch (error: any) {
        console.error("Error creating category:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
