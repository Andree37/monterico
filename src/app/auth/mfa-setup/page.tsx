"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Fingerprint, Shield } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";

export default function MFASetupPage() {
    const router = useRouter();
    const { data: session, status, update } = useSession();
    const [loading, setLoading] = useState(false);
    const [deviceName, setDeviceName] = useState("");

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
            return;
        }

        if (status === "authenticated" && session?.user?.mfaSetupComplete) {
            router.push("/");
            return;
        }
    }, [status, session, router]);

    const handleSetupPasskey = async () => {
        if (!deviceName.trim()) {
            toast.error("Please enter a device name");
            return;
        }

        setLoading(true);

        try {
            const optionsResponse = await fetch(
                "/api/auth/webauthn/register/options",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                },
            );

            if (!optionsResponse.ok) {
                throw new Error("Failed to get registration options");
            }

            const { options, challenge } = await optionsResponse.json();

            const credential = await startRegistration(options);

            const verifyResponse = await fetch(
                "/api/auth/webauthn/register/verify",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        credential,
                        challenge,
                        deviceName: deviceName.trim(),
                    }),
                },
            );

            if (!verifyResponse.ok) {
                throw new Error("Failed to verify registration");
            }

            toast.success("Passkey registered successfully!");

            // Update session with new MFA status
            await update({
                ...session,
                user: {
                    ...session?.user,
                    mfaSetupComplete: true,
                    mfaVerified: true,
                },
            });
        } catch (error) {
            console.error("Error setting up passkey:", error);
            if (error instanceof Error) {
                if (error.name === "NotAllowedError") {
                    toast.error("Passkey registration was cancelled");
                } else {
                    toast.error(error.message || "Failed to set up passkey");
                }
            } else {
                toast.error("Failed to set up passkey. Please try again.");
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
                        Set Up Multi-Factor Authentication
                    </CardTitle>
                    <CardDescription className="text-center">
                        Secure your account with a passkey. This is required to
                        continue.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-3">
                            <Fingerprint className="h-5 w-5 mt-0.5 text-primary" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium">
                                    What is a Passkey?
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Passkeys use your device&apos;s biometric
                                    authentication (Face ID, Touch ID) or
                                    security key for secure, password-free
                                    sign-in.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="deviceName">
                                Device Name (Optional)
                            </Label>
                            <Input
                                id="deviceName"
                                type="text"
                                placeholder="e.g., MacBook Pro, iPhone"
                                value={deviceName}
                                onChange={(e) => setDeviceName(e.target.value)}
                                disabled={loading}
                            />
                            <p className="text-xs text-muted-foreground">
                                Help identify this device later
                            </p>
                        </div>

                        <Button
                            onClick={handleSetupPasskey}
                            className="w-full"
                            size="lg"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Setting up passkey...
                                </>
                            ) : (
                                <>
                                    <Fingerprint className="mr-2 h-4 w-4" />
                                    Set Up Passkey
                                </>
                            )}
                        </Button>

                        <p className="text-xs text-center text-muted-foreground">
                            You can add more authentication methods later in
                            settings
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
