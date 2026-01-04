"use client";

import { useCallback, useState, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface PlaidLinkProps {
    userId?: string;
    onSuccess?: (bankConnectionId: string) => void;
    onExit?: () => void;
}

export function PlaidLink({ userId, onSuccess, onExit }: PlaidLinkProps) {
    const [linkToken, setLinkToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [shouldOpen, setShouldOpen] = useState(false);

    const generateToken = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/plaid/create-link-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });

            const data = await response.json();
            if (data.link_token) {
                setLinkToken(data.link_token);
                setShouldOpen(true);
            }
        } catch (error) {
            console.error("Error generating link token:", error);
        } finally {
            setLoading(false);
        }
    };

    const onPlaidSuccess = useCallback(
        async (publicToken: string, _metadata: unknown) => {
            try {
                const response = await fetch("/api/plaid/exchange-token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ publicToken, userId }),
                });

                const data = await response.json();
                if (data.success && data.bankConnectionId) {
                    onSuccess?.(data.bankConnectionId);
                }
            } catch (error) {
                console.error("Error exchanging token:", error);
            }
        },
        [userId, onSuccess],
    );

    const config = {
        token: linkToken,
        onSuccess: onPlaidSuccess,
        onExit: () => {
            onExit?.();
        },
    };

    const { open, ready } = usePlaidLink(config);

    useEffect(() => {
        if (linkToken && ready && shouldOpen && !loading) {
            open();
            setShouldOpen(false);
        }
    }, [linkToken, ready, shouldOpen, loading, open]);

    const handleClick = () => {
        if (linkToken) {
            open();
        } else {
            generateToken();
        }
    };

    return (
        <Button
            onClick={handleClick}
            disabled={loading || (linkToken !== null && !ready)}
        >
            {loading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                </>
            ) : (
                "Connect Bank Account"
            )}
        </Button>
    );
}
