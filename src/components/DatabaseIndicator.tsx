import { prisma } from "@/lib/db";

export async function DatabaseIndicator() {
    const dbUrl = process.env.DATABASE_URL || "file:./dev.db";

    const isDev = dbUrl.includes("dev.db");
    const isProd = dbUrl.includes("prod.db");

    let isConnected = false;
    try {
        await prisma.$queryRaw`SELECT 1`;
        isConnected = true;
    } catch {
        isConnected = false;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div
                className={`rounded-lg px-3 py-2 text-xs font-medium shadow-lg ${
                    isDev
                        ? "bg-blue-500 text-white"
                        : isProd
                          ? "bg-orange-500 text-white"
                          : "bg-gray-500 text-white"
                }`}
            >
                <div className="flex items-center gap-2">
                    <div
                        className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-300 animate-pulse" : "bg-red-300"}`}
                    />
                    <div className="flex flex-col">
                        <span className="font-semibold">
                            {isDev ? "DEV" : isProd ? "PROD" : "UNKNOWN"}
                        </span>
                        <span className="text-[10px] opacity-80">
                            {dbUrl.replace("file:", "")}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
