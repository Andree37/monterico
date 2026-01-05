import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

interface JWTPayload {
    iss: string;
    aud: string;
    iat: number;
    exp: number;
    jti: string;
}

export function generateJWT(privateKey: string, appId: string): string {
    const now = Math.floor(Date.now() / 1000);

    const payload: JWTPayload = {
        iss: appId,
        aud: "api.enablebanking.com",
        iat: now,
        exp: now + 3600,
        jti: randomUUID(),
    };

    return jwt.sign(payload, privateKey, {
        algorithm: "RS256",
        keyid: appId,
    });
}

export function getAuthHeaders(
    privateKey: string,
    appId: string,
): Record<string, string> {
    const token = generateJWT(privateKey, appId);

    return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };
}
