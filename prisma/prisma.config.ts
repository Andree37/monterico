import { defineConfig } from "@prisma/client/generator-build";
import path from "path";

// Convert relative file path to absolute path
const getDatabaseUrl = () => {
    const envUrl = process.env.DATABASE_URL || "file:./dev.db";

    // If it's a file URL with relative path, convert to absolute
    if (envUrl.startsWith("file:./") || envUrl.startsWith("file:../")) {
        const relativePath = envUrl.replace("file:", "");
        const absolutePath = path.join(process.cwd(), relativePath);
        return `file:${absolutePath}`;
    }

    return envUrl;
};

export default defineConfig({
    datasources: {
        db: {
            url: getDatabaseUrl(),
        },
    },
});
