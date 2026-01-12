import { auth } from "@/auth/config";
import { NextResponse } from "next/server";

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const isOnAuthPage = req.nextUrl.pathname.startsWith("/auth");
    const isAuthApiRoute = req.nextUrl.pathname.startsWith("/api/auth");

    // Allow auth API routes (signup, webauthn, etc.)
    if (isAuthApiRoute) {
        return NextResponse.next();
    }

    // Protect all other API routes
    if (req.nextUrl.pathname.startsWith("/api")) {
        if (!isLoggedIn) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const user = req.auth!.user;

        // Ensure MFA is complete for API access
        if (user.mfaRequired && !user.mfaSetupComplete) {
            return NextResponse.json(
                { error: "MFA setup required" },
                { status: 403 },
            );
        }

        if (user.mfaRequired && user.mfaSetupComplete && !user.mfaVerified) {
            return NextResponse.json(
                { error: "MFA verification required" },
                { status: 403 },
            );
        }

        return NextResponse.next();
    }

    // Public routes that don't require authentication
    if (isOnAuthPage) {
        // If logged in and on signin/signup, redirect based on MFA status
        if (isLoggedIn && req.auth) {
            const user = req.auth.user;

            // If on signin/signup and logged in, check MFA status
            if (
                req.nextUrl.pathname === "/auth/signin" ||
                req.nextUrl.pathname === "/auth/signup"
            ) {
                if (!user.mfaSetupComplete) {
                    return NextResponse.redirect(
                        new URL("/auth/mfa-setup", req.url),
                    );
                } else if (!user.mfaVerified) {
                    return NextResponse.redirect(
                        new URL("/auth/mfa-verify", req.url),
                    );
                } else {
                    return NextResponse.redirect(new URL("/", req.url));
                }
            }

            // Redirect away from MFA setup if already complete
            if (req.nextUrl.pathname === "/auth/mfa-setup") {
                if (user.mfaSetupComplete) {
                    return NextResponse.redirect(new URL("/", req.url));
                }
                return NextResponse.next();
            }

            // Allow access to MFA verify if setup complete but not verified
            if (
                req.nextUrl.pathname === "/auth/mfa-verify" &&
                user.mfaSetupComplete &&
                !user.mfaVerified
            ) {
                return NextResponse.next();
            }

            // If MFA setup complete and verified, redirect to home
            if (user.mfaSetupComplete && user.mfaVerified) {
                return NextResponse.redirect(new URL("/", req.url));
            }
        }

        // Allow access to auth pages if not logged in
        return NextResponse.next();
    }

    // Protected routes - require authentication
    if (!isLoggedIn) {
        return NextResponse.redirect(new URL("/auth/signin", req.url));
    }

    const user = req.auth!.user;

    // Enforce MFA setup
    if (user.mfaRequired && !user.mfaSetupComplete) {
        return NextResponse.redirect(new URL("/auth/mfa-setup", req.url));
    }

    // Enforce MFA verification
    if (user.mfaRequired && user.mfaSetupComplete && !user.mfaVerified) {
        return NextResponse.redirect(new URL("/auth/mfa-verify", req.url));
    }

    return NextResponse.next();
});

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
