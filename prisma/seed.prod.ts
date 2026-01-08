import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");

const adapter = new PrismaLibSql({
    url: `file:${dbPath}`,
});

const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Seeding production database...");

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

    console.log(`Created ${categories.length} categories`);
    console.log("Production seeding completed!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
