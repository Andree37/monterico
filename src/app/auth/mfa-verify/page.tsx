"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Fingerprint, Shield } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";

export default function MFAVerifyPage() {
    const router = useRouter();
    const { data: session, status, update } = useSession();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        }

        if (status === "authenticated") {
            if (!session?.user?.mfaSetupComplete) {
                router.push("/auth/mfa-setup");
            } else if (session?.user?.mfaVerified) {
                router.push("/");
            }
        }
    }, [status, session, router]);

    const handleVerifyPasskey = async () => {
        setLoading(true);

        try {
            const optionsResponse = await fetch(
                "/api/auth/webauthn/authenticate/options",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                },
            );

            if (!optionsResponse.ok) {
                const errorData = await optionsResponse.json();
                console.error("Authentication options error:", errorData);
                throw new Error(
                    errorData.error || "Failed to get authentication options",
                );
            }

            const { options, challenge } = await optionsResponse.json();

            const credential = await startAuthentication(options);

            const verifyResponse = await fetch(
                "/api/auth/webauthn/authenticate/verify",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        credential,
                        challenge,
                    }),
                },
            );

            if (!verifyResponse.ok) {
                throw new Error("Failed to verify authentication");
            }

            toast.success("Authentication successful!");

            // Update session to mark MFA as verified
            await update({
                ...session,
                user: {
                    ...session?.user,
                    mfaVerified: true,
                },
            });
        } catch (error) {
            console.error("Error verifying passkey:", error);
            if (error instanceof Error) {
                if (error.name === "NotAllowedError") {
                    toast.error("Authentication was cancelled");
                } else {
                    toast.error(error.message || "Failed to authenticate");
                }
            } else {
                toast.error("Failed to authenticate. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 rounded-full bg-primary/10">
                            <Shield className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">
                        Verify Your Identity
                    </CardTitle>
                    <CardDescription className="text-center">
                        Use your passkey to complete sign-in
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-3">
                            <Fingerprint className="h-5 w-5 mt-0.5 text-primary" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium">
                                    Multi-Factor Authentication Required
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Authenticate using your device&apos;s
                                    biometric authentication or security key.
                                </p>
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={handleVerifyPasskey}
                        className="w-full"
                        size="lg"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Authenticating...
                            </>
                        ) : (
                            <>
                                <Fingerprint className="mr-2 h-4 w-4" />
                                Authenticate with Passkey
                            </>
                        )}
                    </Button>

                    <div className="text-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                signOut({ callbackUrl: "/auth/signin" })
                            }
                            disabled={loading}
                        >
                            Back to Sign In
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
