"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

interface BankMfaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function BankMfaDialog({
    open,
    onOpenChange,
    onSuccess,
}: BankMfaDialogProps) {
    const [isVerifying, setIsVerifying] = useState(false);
    const { update } = useSession();

    const handleVerify = async () => {
        setIsVerifying(true);
        try {
            const optionsResponse = await fetch(
                "/api/auth/webauthn/authenticate/options",
                {
                    method: "POST",
                },
            );

            if (!optionsResponse.ok) {
                throw new Error("Failed to get authentication options");
            }

            const options = await optionsResponse.json();

            const credential = await startAuthentication(options.options);

            const verifyResponse = await fetch("/api/auth/bank-mfa/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    method: "passkey",
                    credential,
                    challenge: options.challenge,
                }),
            });

            if (!verifyResponse.ok) {
                const error = await verifyResponse.json();
                throw new Error(error.error || "Verification failed");
            }

            const result = await verifyResponse.json();

            // Update the session with the new bank operation MFA timestamp
            if (result.updateSession && result.bankOperationMfaVerifiedAt) {
                await update({
                    user: {
                        bankOperationMfaVerifiedAt:
                            result.bankOperationMfaVerifiedAt,
                    },
                });

                // Force a small delay to ensure session is persisted
                await new Promise((resolve) => setTimeout(resolve, 300));
            }

            toast.success("Bank operation access verified");
            onOpenChange(false);
            onSuccess();
        } catch (error) {
            console.error("Bank MFA verification error:", error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to verify. Please try again.",
            );
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        Bank Operation Verification
                    </DialogTitle>
                    <DialogDescription>
                        For your security, please verify your identity to access
                        bank operations. This verification is valid for 15
                        minutes.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="rounded-lg bg-muted/50 p-4">
                        <p className="text-sm text-muted-foreground">
                            You&apos;ll be prompted to use your passkey
                            (fingerprint, face recognition, or security key) to
                            verify this operation.
                        </p>
                    </div>

                    <Button
                        onClick={handleVerify}
                        disabled={isVerifying}
                        className="w-full"
                    >
                        {isVerifying ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                Verify with Passkey
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
