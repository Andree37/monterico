"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function CallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<"loading" | "success" | "error">(
        "loading",
    );
    const [message, setMessage] = useState(
        "Processing your bank connection...",
    );

    useEffect(() => {
        const processCallback = async () => {
            const code = searchParams.get("code");
            const state = searchParams.get("state");
            const error = searchParams.get("error");

            if (error) {
                setStatus("error");
                setMessage(`Connection failed: ${error}`);
                return;
            }

            if (!code) {
                setStatus("error");
                setMessage("Missing authorization code. Please try again.");
                return;
            }

            // Retrieve session_id from localStorage using state
            let sessionId = searchParams.get("session_id");

            if (!sessionId && state) {
                sessionId = localStorage.getItem(`eb_session_${state}`);

                // Clean up localStorage
                if (sessionId) {
                    localStorage.removeItem(`eb_session_${state}`);
                }
            }

            if (!sessionId) {
                setStatus("error");
                setMessage("Missing session ID. Please try again.");
                return;
            }

            try {
                const callbackUrl = `/api/enablebanking/callback?code=${encodeURIComponent(code)}&session_id=${encodeURIComponent(sessionId)}${state ? `&state=${encodeURIComponent(state)}` : ""}`;

                const response = await fetch(callbackUrl, { method: "GET" });

                if (response.redirected) {
                    window.location.href = response.url;
                    return;
                }

                const data = await response.json();

                if (data.error) {
                    setStatus("error");
                    setMessage(data.error);
                } else {
                    setStatus("success");
                    setMessage("Bank connection successful!");
                    setTimeout(() => {
                        router.push("/");
                    }, 2000);
                }
            } catch (err) {
                console.error("Error in callback processing:", err);
                setStatus("error");
                setMessage(
                    err instanceof Error
                        ? err.message
                        : "An unexpected error occurred",
                );
            }
        };

        processCallback();
    }, [searchParams, router]);

    return (
        <div className="container mx-auto flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {status === "loading" && (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        )}
                        {status === "success" && (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                        {status === "error" && (
                            <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        {status === "loading" && "Connecting..."}
                        {status === "success" && "Success!"}
                        {status === "error" && "Error"}
                    </CardTitle>
                    <CardDescription>{message}</CardDescription>
                </CardHeader>
                <CardContent>
                    {status === "error" && (
                        <Button
                            onClick={() => router.push("/")}
                            className="w-full"
                        >
                            Return to Home
                        </Button>
                    )}
                    {status === "success" && (
                        <p className="text-sm text-muted-foreground">
                            Redirecting you to the dashboard...
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function CallbackPage() {
    return (
        <Suspense
            fallback={
                <div className="container mx-auto flex min-h-screen items-center justify-center p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Loading...
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            }
        >
            <CallbackContent />
        </Suspense>
    );
}
