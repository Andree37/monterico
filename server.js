import { createServer } from "https";
import { parse } from "url";
import next from "next";
import fs from "fs";
import path from "path";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const certDir = path.join(__dirname, "certs");
const keyPath = path.join(certDir, "localhost-key.pem");
const certPath = path.join(certDir, "localhost.pem");

let httpsOptions;

try {
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        httpsOptions = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
        };
    } else {
        console.log("\n⚠️  HTTPS certificates not found!");
        console.log("\nPlease generate certificates using mkcert:\n");
        console.log("  brew install mkcert");
        console.log("  mkcert -install");
        console.log("  mkdir -p certs");
        console.log(
            "  mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost\n",
        );
        process.exit(1);
    }
} catch (error) {
    console.error("Error loading certificates:", error);
    process.exit(1);
}

app.prepare().then(() => {
    createServer(httpsOptions, async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error("Error occurred handling", req.url, err);
            res.statusCode = 500;
            res.end("internal server error");
        }
    }).listen(port, (err) => {
        if (err) throw err;
        console.log(`\n✅ Ready on https://${hostname}:${port}\n`);
    });
});
