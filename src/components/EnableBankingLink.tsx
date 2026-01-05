"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface EnableBankingLinkProps {
    userId?: string;
    onSuccess?: (bankConnectionId: string) => void;
}

interface Bank {
    id: string;
    name: string;
    country: string;
}

export function EnableBankingLink({ userId }: EnableBankingLinkProps) {
    const [loading, setLoading] = useState(false);
    const [selectedBank, setSelectedBank] = useState<string>("");
    const [open, setOpen] = useState(false);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [loadingBanks, setLoadingBanks] = useState(false);

    useEffect(() => {
        const fetchBanks = async () => {
            setLoadingBanks(true);
            try {
                const response = await fetch(
                    "/api/enablebanking/banks?country=IE&psu_type=personal",
                );
                const data = await response.json();
                if (data.banks) {
                    setBanks(data.banks);
                }
            } catch (error) {
                console.error("Failed to fetch banks:", error);
                toast.error("Failed to load available banks");
            } finally {
                setLoadingBanks(false);
            }
        };

        if (open && banks.length === 0) {
            fetchBanks();
        }
    }, [open, banks.length]);

    const handleConnect = async () => {
        if (!selectedBank) {
            toast.error("Please select a bank");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch("/api/enablebanking/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    aspsp: selectedBank,
                    userId,
                    psuType: "personal",
                }),
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (!data.url) {
                throw new Error("No authorization URL received");
            }

            if (!data.state) {
                throw new Error("No state received");
            }

            // Extract session_id from URL query parameter
            const urlObj = new URL(data.url);
            const sessionId = urlObj.searchParams.get("sessionid");

            if (!sessionId) {
                throw new Error("No session ID in authorization URL");
            }

            // Store session_id in localStorage to retrieve during callback
            localStorage.setItem(`eb_session_${data.state}`, sessionId);

            window.location.href = data.url;
        } catch (error) {
            console.error("Enable Banking connection error:", error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to connect bank",
            );
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full" disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                        </>
                    ) : (
                        "Connect Bank Account"
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Connect Your Bank</DialogTitle>
                    <DialogDescription>
                        Select your bank to securely connect your account using
                        Open Banking.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label
                            htmlFor="bank-select"
                            className="text-sm font-medium"
                        >
                            Select Bank
                        </label>
                        <Select
                            value={selectedBank}
                            onValueChange={setSelectedBank}
                            disabled={loadingBanks}
                        >
                            <SelectTrigger id="bank-select">
                                <SelectValue
                                    placeholder={
                                        loadingBanks
                                            ? "Loading banks..."
                                            : "Choose your bank"
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {loadingBanks ? (
                                    <SelectItem value="loading" disabled>
                                        Loading banks...
                                    </SelectItem>
                                ) : banks.length === 0 ? (
                                    <SelectItem value="none" disabled>
                                        No banks available
                                    </SelectItem>
                                ) : (
                                    banks.map((bank) => (
                                        <SelectItem
                                            key={bank.id}
                                            value={bank.id}
                                        >
                                            {bank.name}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        onClick={handleConnect}
                        disabled={loading || !selectedBank || loadingBanks}
                        className="w-full"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            "Continue"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
