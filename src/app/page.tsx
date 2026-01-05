"use client";

import { useEffect, useState, useCallback } from "react";
import { PlaidLink } from "@/components/PlaidLink";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Loader2, RefreshCw, Trash2, Building2 } from "lucide-react";

interface Account {
    id: string;
    accountId: string;
    name: string;
    type: string;
    subtype: string | null;
    currentBalance: number | null;
    availableBalance: number | null;
    currency: string | null;
}

interface BankConnection {
    id: string;
    itemId: string;
    institutionName: string | null;
    status: string;
    createdAt: string;
    userId: string | null;
    accounts: Account[];
    _count: {
        transactions: number;
    };
}

export default function Home() {
    const [bankConnections, setBankConnections] = useState<BankConnection[]>(
        [],
    );
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<string | null>(null);

    const loadBankConnections = async () => {
        try {
            const response = await fetch("/api/bank-connections");
            if (response.ok) {
                const data = await response.json();
                setBankConnections(data.bankConnections || []);
            }
        } catch (error) {
            console.error("Error loading bank connections:", error);
        }
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            await loadBankConnections();
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handlePlaidSuccess = async () => {
        toast.success("Bank account connected successfully");
        await loadData();
    };

    const syncTransactions = async (connectionId: string) => {
        setSyncing(connectionId);
        try {
            const response = await fetch("/api/plaid/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bankConnectionId: connectionId }),
            });

            if (response.ok) {
                toast.success("Transactions synced successfully");
            } else {
                throw new Error("Failed to sync transactions");
            }
        } catch {
            toast.error("Failed to sync transactions");
        } finally {
            setSyncing(null);
        }
    };

    const deleteConnection = async (connectionId: string) => {
        if (!confirm("Are you sure you want to delete this connection?"))
            return;

        try {
            const response = await fetch(
                `/api/bank-connections?id=${connectionId}`,
                {
                    method: "DELETE",
                },
            );

            if (response.ok) {
                toast.success("Bank connection deleted");
                await loadData();
            }
        } catch {
            toast.error("Failed to delete connection");
        }
    };

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Connect Your Bank</CardTitle>
                        <CardDescription>
                            Link your bank accounts to automatically import
                            transactions
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <PlaidLink onSuccess={handlePlaidSuccess} />
                    </CardContent>
                </Card>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {bankConnections.map((connection) => (
                            <Card key={connection.id}>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Building2 className="h-5 w-5" />
                                            <div>
                                                <CardTitle className="text-lg">
                                                    {connection.institutionName ||
                                                        "Bank"}
                                                </CardTitle>
                                                <CardDescription>
                                                    {connection.accounts.length}{" "}
                                                    account(s) •{" "}
                                                    {
                                                        connection._count
                                                            .transactions
                                                    }{" "}
                                                    transactions
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() =>
                                                    syncTransactions(
                                                        connection.id,
                                                    )
                                                }
                                                disabled={
                                                    syncing === connection.id
                                                }
                                            >
                                                {syncing === connection.id ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                        Syncing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw className="h-4 w-4 mr-2" />
                                                        Sync Transactions
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    deleteConnection(
                                                        connection.id,
                                                    )
                                                }
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {connection.accounts.map((account) => (
                                            <div
                                                key={account.id}
                                                className="flex items-center justify-between p-3 bg-muted/50 rounded"
                                            >
                                                <div>
                                                    <p className="font-medium">
                                                        {account.name}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {account.type} •{" "}
                                                        {account.subtype}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-semibold">
                                                        €
                                                        {account.currentBalance?.toFixed(
                                                            2,
                                                        ) || "0.00"}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Available: €
                                                        {account.availableBalance?.toFixed(
                                                            2,
                                                        ) || "0.00"}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
