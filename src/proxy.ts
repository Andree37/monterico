import { auth } from "@/auth/config";
import { NextResponse } from "next/server";

export default auth((req) => {
    const { pathname } = req.nextUrl;
    const isLoggedIn = !!req.auth;
    const isMfaVerified = req.auth?.user?.mfaVerified;
    const isApiRoute = pathname.startsWith("/api");

    // Tier 1: Public routes (no auth required)
    const publicRoutes = ["/auth/signin", "/auth/signup"];
    const isPublicRoute = publicRoutes.some((route) =>
        pathname.startsWith(route),
    );

    // Public API routes (no auth required)
    const publicApiRoutes = [
        "/api/auth/signin",
        "/api/auth/signup",
        "/api/auth/session",
        "/api/auth/callback",
        "/api/auth/csrf",
        "/api/auth/providers",
    ];
    const isPublicApiRoute = publicApiRoutes.some((route) =>
        pathname.startsWith(route),
    );

    // Tier 2: Auth-only routes (logged in, but MFA not required)
    const authOnlyRoutes = ["/auth/mfa-setup", "/auth/mfa-verify"];
    const isAuthOnlyRoute = authOnlyRoutes.some((route) =>
        pathname.startsWith(route),
    );

    // Auth-only API routes (logged in, but MFA not required)
    const authOnlyApiRoutes = [
        "/api/auth/mfa",
        "/api/auth/webauthn",
        "/api/auth/bank-mfa",
    ];
    const isAuthOnlyApiRoute = authOnlyApiRoutes.some((route) =>
        pathname.startsWith(route),
    );

    // Tier 3: Everything else requires auth + MFA verification
    const requiresMfaVerification =
        !isPublicRoute &&
        !isAuthOnlyRoute &&
        !isPublicApiRoute &&
        !isAuthOnlyApiRoute;

    // Handle API routes
    if (isApiRoute) {
        // Allow public API routes
        if (isPublicApiRoute) {
            return NextResponse.next();
        }

        // Require auth for auth-only API routes
        if (isAuthOnlyApiRoute) {
            if (!isLoggedIn) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 },
                );
            }
            return NextResponse.next();
        }

        // Require auth + MFA for all other API routes
        if (!isLoggedIn) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        if (!isMfaVerified) {
            return NextResponse.json(
                { error: "MFA verification required" },
                { status: 403 },
            );
        }

        return NextResponse.next();
    }

    // Handle page routes
    // Redirect unauthenticated users to signin
    if (!isLoggedIn && !isPublicRoute) {
        const signInUrl = new URL("/auth/signin", req.url);
        signInUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(signInUrl);
    }

    // Redirect authenticated users away from public routes
    if (isLoggedIn && isPublicRoute) {
        // If they need MFA setup/verification, redirect there
        if (!isMfaVerified) {
            const user = req.auth?.user;
            if (user?.mfaRequired && !user?.mfaSetupComplete) {
                return NextResponse.redirect(
                    new URL("/auth/mfa-setup", req.url),
                );
            }
            if (user?.mfaRequired && user?.mfaSetupComplete) {
                return NextResponse.redirect(
                    new URL("/auth/mfa-verify", req.url),
                );
            }
        }
        // Otherwise redirect to home
        return NextResponse.redirect(new URL("/", req.url));
    }

    // Redirect users who need MFA verification to appropriate page
    if (isLoggedIn && requiresMfaVerification && !isMfaVerified) {
        const user = req.auth?.user;
        if (user?.mfaRequired && !user?.mfaSetupComplete) {
            return NextResponse.redirect(new URL("/auth/mfa-setup", req.url));
        }
        if (user?.mfaRequired && user?.mfaSetupComplete) {
            return NextResponse.redirect(new URL("/auth/mfa-verify", req.url));
        }
    }

    // Redirect users who are on MFA pages but don't need them
    if (isLoggedIn && isAuthOnlyRoute && isMfaVerified) {
        return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\..*|monitoring).*)",
    ],
};
