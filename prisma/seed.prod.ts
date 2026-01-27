import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

const dbUrl = process.env.DATABASE_URL || "file:./prod.db";
console.log("DB URL:", dbUrl);

const adapter = new PrismaLibSql({
    url: dbUrl,
});

const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Seeding production database...");

    // Create default categories for this user
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
        await prisma.category.create({
            data: {
                userId: "0e40e403-d43f-4311-b9b3-31d183378c78",
                name: category.name,
                color: category.color,
                icon: category.icon,
            },
        });
    }

    console.log("Created user settings");

    console.log("\n✅ Production seeding completed!");
    console.log("\nYou can now log in with:");
    console.log(`  Email: admin@example.com`);
    console.log(`  Password: changeme123`);
    console.log(
        "\n⚠️  IMPORTANT: Change the password immediately after first login!",
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
