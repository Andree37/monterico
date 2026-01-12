import { prisma } from "@/lib/db";

export interface HouseholdMemberWithRatio {
    id: string;
    userId: string;
    name: string;
    isActive: boolean;
    ratio: number;
    createdAt: Date;
    updatedAt: Date;
}

export async function getActiveHouseholdMembers(
    userId: string,
): Promise<HouseholdMemberWithRatio[]> {
    const members = await prisma.householdMember.findMany({
        where: {
            userId,
            isActive: true,
        },
        orderBy: {
            createdAt: "asc",
        },
    });

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

    return membersWithRatios;
}

export async function getAllHouseholdMembers(
    userId: string,
): Promise<HouseholdMemberWithRatio[]> {
    const members = await prisma.householdMember.findMany({
        where: {
            userId,
        },
        orderBy: {
            createdAt: "asc",
        },
    });

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

    return membersWithRatios;
}

export async function getHouseholdMemberById(
    memberId: string,
): Promise<HouseholdMemberWithRatio | null> {
    const member = await prisma.householdMember.findUnique({
        where: { id: memberId },
    });

    if (!member) {
        return null;
    }

    const splitRatio = await prisma.householdMemberSplitRatio.findUnique({
        where: { householdMemberId: member.id },
    });

    return {
        ...member,
        ratio: splitRatio?.ratio || 0.5,
    };
}

export async function createHouseholdMember(
    userId: string,
    name: string,
    ratio?: number,
): Promise<HouseholdMemberWithRatio> {
    const member = await prisma.householdMember.create({
        data: {
            userId,
            name,
            isActive: true,
        },
    });

    await prisma.householdMemberSplitRatio.create({
        data: {
            householdMemberId: member.id,
            ratio: ratio !== undefined ? ratio : 0.5,
            isActive: true,
        },
    });

    return {
        ...member,
        ratio: ratio !== undefined ? ratio : 0.5,
    };
}

export async function updateHouseholdMember(
    memberId: string,
    data: {
        name?: string;
        isActive?: boolean;
        ratio?: number;
    },
): Promise<HouseholdMemberWithRatio | null> {
    const updateData: { name?: string; isActive?: boolean } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const member = await prisma.householdMember.update({
        where: { id: memberId },
        data: updateData,
    });

    if (data.ratio !== undefined) {
        await prisma.householdMemberSplitRatio.upsert({
            where: { householdMemberId: memberId },
            update: { ratio: data.ratio },
            create: {
                householdMemberId: memberId,
                ratio: data.ratio,
                isActive: true,
            },
        });
    }

    const splitRatio = await prisma.householdMemberSplitRatio.findUnique({
        where: { householdMemberId: memberId },
    });

    return {
        ...member,
        ratio: splitRatio?.ratio || 0.5,
    };
}

export async function deleteHouseholdMember(
    memberId: string,
): Promise<boolean> {
    await prisma.householdMember.update({
        where: { id: memberId },
        data: { isActive: false },
    });

    return true;
}
