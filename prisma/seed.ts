import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
console.log("DB URL:", dbUrl);

const adapter = new PrismaLibSql({
    url: dbUrl,
});

const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Seeding database...");

    // Create default user account
    const hashedPassword = await bcrypt.hash("password123", 10);

    const user = await prisma.user.upsert({
        where: { email: "andre@example.com" },
        update: {},
        create: {
            email: "andre@example.com",
            password: hashedPassword,
            mfaRequired: false,
            mfaSetupComplete: false,
            accountingMode: "shared_pool",
        },
    });

    console.log("Created user account");

    // Create household members
    const householdMembers = [
        { name: "Andre Ribeiro", ratio: 0.65 },
        { name: "Rita Pereira", ratio: 0.35 },
    ];

    const members = [];
    for (const memberData of householdMembers) {
        // Check if member already exists
        let member = await prisma.householdMember.findFirst({
            where: {
                userId: user.id,
                name: memberData.name,
            },
        });

        // Create if doesn't exist
        if (!member) {
            member = await prisma.householdMember.create({
                data: {
                    userId: user.id,
                    name: memberData.name,
                    isActive: true,
                },
            });
        }

        // Create split ratio for the household member
        await prisma.householdMemberSplitRatio.upsert({
            where: { householdMemberId: member.id },
            update: { ratio: memberData.ratio, isActive: true },
            create: {
                householdMemberId: member.id,
                ratio: memberData.ratio,
                isActive: true,
            },
        });

        members.push(member);
    }

    console.log(
        `Created ${members.length} household members with split ratios`,
    );

    // Create default user settings
    await prisma.userSettings.upsert({
        where: { userId: user.id },
        update: {},
        create: {
            userId: user.id,
            defaultType: "shared",
            defaultSplitType: "equal",
        },
    });

    console.log("Created user settings");

    const categories = [
        { name: "Coisas de casa", color: "#FF9800", icon: "🏠" },
        { name: "Comida em casa", color: "#4CAF50", icon: "🍽️" },
        { name: "Entretenimento", color: "#9C27B0", icon: "🎬" },
        { name: "Hobbies", color: "#795548", icon: "🎨" },
        { name: "Prendas", color: "#E91E63", icon: "🎁" },
        { name: "Renda", color: "#8BC34A", icon: "🏘️" },
        { name: "Restaurantes", color: "#F06292", icon: "🍴" },
        { name: "Roupa", color: "#FF5722", icon: "👕" },
        { name: "Saude", color: "#2196F3", icon: "🏥" },
        { name: "Self Care", color: "#00BCD4", icon: "💆" },
        { name: "Serviços", color: "#607D8B", icon: "🔧" },
        { name: "Transportes", color: "#9E9E9E", icon: "🚗" },
        { name: "Viagens", color: "#03A9F4", icon: "✈️" },
    ];

    for (const category of categories) {
        await prisma.category.upsert({
            where: {
                userId_name: {
                    userId: user.id,
                    name: category.name,
                },
            },
            update: {},
            create: {
                userId: user.id,
                name: category.name,
                color: category.color,
                icon: category.icon,
            },
        });
    }

    console.log("Created categories");

    // Create sample income for last 3 months and next 2 months
    const now = new Date();
    const incomeMonths = [];
    // Past 3 months
    for (let i = 3; i >= 1; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        incomeMonths.push(date);
    }
    // Current month and next 2 months
    for (let i = 0; i <= 2; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
        incomeMonths.push(date);
    }

    for (const month of incomeMonths) {
        // Rita's salary on the 22nd (allocated to next month)
        const ritaSalaryDate = new Date(
            month.getFullYear(),
            month.getMonth(),
            22,
        );
        const ritaSalaryMonth = new Date(
            month.getFullYear(),
            month.getMonth() + 1,
            1,
        );

        await prisma.income.create({
            data: {
                userId: user.id,
                householdMemberId: members[1].id, // Rita
                date: ritaSalaryDate.toISOString(),
                allocatedToMonth: `${ritaSalaryMonth.getFullYear()}-${String(ritaSalaryMonth.getMonth() + 1).padStart(2, "0")}`,
                description: `Salario - ${ritaSalaryMonth.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}`,
                type: "Salario",
                amount: 2000,
                currency: "EUR",
            },
        });

        // Andre's salary on the 27th (allocated to next month)
        const andreSalaryDate = new Date(
            month.getFullYear(),
            month.getMonth(),
            27,
        );
        const andreSalaryMonth = new Date(
            month.getFullYear(),
            month.getMonth() + 1,
            1,
        );

        await prisma.income.create({
            data: {
                userId: user.id,
                householdMemberId: members[0].id, // Andre
                date: andreSalaryDate.toISOString(),
                allocatedToMonth: `${andreSalaryMonth.getFullYear()}-${String(andreSalaryMonth.getMonth() + 1).padStart(2, "0")}`,
                description: `Salario - ${andreSalaryMonth.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}`,
                type: "Salario",
                amount: 6000,
                currency: "EUR",
            },
        });
    }

    console.log("Created sample income");

    // Create sample expenses for last 3 months
    const expenseMonths = [];
    for (let i = 2; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        expenseMonths.push(date);
    }

    // Get categories
    const comidaCategory = await prisma.category.findFirst({
        where: { userId: user.id, name: "Comida em casa" },
    });
    const restaurantsCategory = await prisma.category.findFirst({
        where: { userId: user.id, name: "Restaurantes" },
    });
    const transportesCategory = await prisma.category.findFirst({
        where: { userId: user.id, name: "Transportes" },
    });
    const rendaCategory = await prisma.category.findFirst({
        where: { userId: user.id, name: "Renda" },
    });
    const saudeCategory = await prisma.category.findFirst({
        where: { userId: user.id, name: "Saude" },
    });
    const entretenimentoCategory = await prisma.category.findFirst({
        where: { userId: user.id, name: "Entretenimento" },
    });

    const expenseTemplates = [
        {
            category: rendaCategory,
            description: "Renda mensal",
            amount: 1200,
            type: "shared",
            paidByIndex: 0,
        },
        {
            category: comidaCategory,
            description: "Supermercado",
            amount: 150,
            type: "shared",
            paidByIndex: 0,
        },
        {
            category: comidaCategory,
            description: "Supermercado semanal",
            amount: 120,
            type: "shared",
            paidByIndex: 1,
        },
        {
            category: restaurantsCategory,
            description: "Jantar em restaurante",
            amount: 45,
            type: "shared",
            paidByIndex: 0,
        },
        {
            category: restaurantsCategory,
            description: "Almoço fora",
            amount: 30,
            type: "shared",
            paidByIndex: 1,
        },
        {
            category: transportesCategory,
            description: "Combustível",
            amount: 60,
            type: "personal",
            paidByIndex: 0,
        },
        {
            category: transportesCategory,
            description: "Passe mensal",
            amount: 40,
            type: "personal",
            paidByIndex: 1,
        },
        {
            category: saudeCategory,
            description: "Farmácia",
            amount: 25,
            type: "shared",
            paidByIndex: 0,
        },
        {
            category: entretenimentoCategory,
            description: "Cinema",
            amount: 20,
            type: "shared",
            paidByIndex: 1,
        },
    ];

    for (const month of expenseMonths) {
        for (const template of expenseTemplates) {
            if (!template.category) continue;

            const dayOffset = Math.floor(Math.random() * 28) + 1;
            const expenseDate = new Date(
                month.getFullYear(),
                month.getMonth(),
                dayOffset,
            );

            const paidByMember = members[template.paidByIndex % members.length];

            const expense = await prisma.expense.create({
                data: {
                    userId: user.id,
                    date: expenseDate.toISOString(),
                    description: template.description,
                    amount:
                        template.amount + Math.floor(Math.random() * 20) - 10,
                    currency: "EUR",
                    type: template.type,
                    paid: true,
                    categoryId: template.category.id,
                    paidById: paidByMember.id,
                },
            });

            // Create splits
            if (template.type === "shared") {
                // Get all active household members and their ratios
                const activeMembers = await prisma.householdMember.findMany({
                    where: {
                        userId: user.id,
                        isActive: true,
                    },
                    include: {
                        splitRatio: true,
                    },
                });

                const totalRatio = activeMembers.reduce(
                    (sum, m) => sum + (m.splitRatio?.ratio || 0),
                    0,
                );

                for (const member of activeMembers) {
                    const ratio = member.splitRatio?.ratio || 0;
                    await prisma.expenseSplit.create({
                        data: {
                            expenseId: expense.id,
                            householdMemberId: member.id,
                            amount: (expense.amount * ratio) / totalRatio,
                            paid: member.id === paidByMember.id,
                        },
                    });
                }
            } else {
                // Personal expense
                await prisma.expenseSplit.create({
                    data: {
                        expenseId: expense.id,
                        householdMemberId: paidByMember.id,
                        amount: expense.amount,
                        paid: true,
                    },
                });
            }
        }
    }

    console.log("Created sample expenses");

    console.log("Seeding completed!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
