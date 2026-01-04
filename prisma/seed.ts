import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");
console.log("DB Path:", dbPath);

const adapter = new PrismaLibSql({
    url: `file:${dbPath}`,
});

const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Seeding database...");

    // Create default users - you can modify this array to add more users
    const defaultUsers = [
        {
            id: "andre",
            name: "Andre Ribeiro",
            email: "andre@example.com",
            ratio: 0.65,
        },
        {
            id: "rita",
            name: "Rita Pereira",
            email: "rita@example.com",
            ratio: 0.35,
        },
    ];

    const users = [];
    for (const userData of defaultUsers) {
        const user = await prisma.user.upsert({
            where: { id: userData.id },
            update: {},
            create: {
                id: userData.id,
                name: userData.name,
                email: userData.email,
            },
        });

        // Create or update split ratio for the user
        await prisma.userSplitRatio.upsert({
            where: { userId: user.id },
            update: { ratio: userData.ratio, isActive: true },
            create: {
                userId: user.id,
                ratio: userData.ratio,
                isActive: true,
            },
        });

        users.push(user);
    }

    console.log(`Created ${users.length} users with split ratios`);

    // Create default settings
    await prisma.settings.upsert({
        where: { id: "default" },
        update: {},
        create: {
            id: "default",
            defaultPaidBy: users[0]?.id || null,
            defaultType: "shared",
            defaultSplitType: "equal",
        },
    });

    console.log("Created settings");

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
            where: { name: category.name },
            update: {},
            create: category,
        });
    }

    console.log("Created categories");

    // Create sample income for last 3 months and next 2 months (so they allocate to the next month)
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
    const months = incomeMonths;

    for (const month of months) {
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
                userId: users[1].id, // Rita
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
                userId: users[0].id, // Andre
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

    // Create sample expenses
    const comidaCategory = await prisma.category.findFirst({
        where: { name: "Comida em casa" },
    });
    const restaurantsCategory = await prisma.category.findFirst({
        where: { name: "Restaurantes" },
    });
    const transportesCategory = await prisma.category.findFirst({
        where: { name: "Transportes" },
    });
    const rendaCategory = await prisma.category.findFirst({
        where: { name: "Renda" },
    });
    const saudeCategory = await prisma.category.findFirst({
        where: { name: "Saude" },
    });
    const entretenimentoCategory = await prisma.category.findFirst({
        where: { name: "Entretenimento" },
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

            const paidByUser = users[template.paidByIndex % users.length];

            const expense = await prisma.expense.create({
                data: {
                    date: expenseDate.toISOString(),
                    description: template.description,
                    amount:
                        template.amount + Math.floor(Math.random() * 20) - 10, // Add some variance
                    currency: "EUR",
                    type: template.type,
                    paid: true,
                    categoryId: template.category.id,
                    paidById: paidByUser.id,
                },
            });

            // Create splits
            if (template.type === "shared") {
                // Get all active users and their ratios
                const activeUsers = await prisma.user.findMany({
                    include: {
                        _count: true,
                    },
                });

                const userRatios = await prisma.userSplitRatio.findMany({
                    where: {
                        userId: { in: activeUsers.map((u) => u.id) },
                        isActive: true,
                    },
                });

                // Calculate split based on ratios (or equal if no ratios)
                const totalRatio = userRatios.reduce(
                    (sum, ur) => sum + ur.ratio,
                    0,
                );

                const splits = userRatios.map((ur) => ({
                    expenseId: expense.id,
                    userId: ur.userId,
                    amount: (expense.amount * ur.ratio) / totalRatio,
                    paid: ur.userId === paidByUser.id,
                }));

                await prisma.expenseSplit.createMany({
                    data: splits,
                });
            } else {
                // Personal expense
                await prisma.expenseSplit.create({
                    data: {
                        expenseId: expense.id,
                        userId: paidByUser.id,
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
