"use client";

import { useEffect, useState, useCallback } from "react";
import { EnableBankingLink } from "@/components/EnableBankingLink";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, Trash2, Building2, Tag } from "lucide-react";
import { BankMfaDialog } from "@/components/bank-mfa/BankMfaDialog";
import { bankFetch, isBankMfaError } from "@/lib/bank-fetch";

interface Account {
    id: string;
    accountId: string;
    name: string;
    type: string;
    subtype: string | null;
    currentBalance: number | null;
    availableBalance: number | null;
    currency: string | null;
    accountType: string | null;
    ownerId: string | null;
}

interface HouseholdMember {
    id: string;
    name: string;
    isActive: boolean;
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
    const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>(
        [],
    );
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [refreshingBalance, setRefreshingBalance] = useState<string | null>(
        null,
    );
    const [showMfaDialog, setShowMfaDialog] = useState(false);
    const [pendingOperation, setPendingOperation] = useState<
        (() => Promise<void>) | null
    >(null);

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

    const loadHouseholdMembers = async () => {
        try {
            const response = await fetch("/api/household-members");
            if (response.ok) {
                const data = await response.json();
                setHouseholdMembers(data.householdMembers || []);
            }
        } catch (error) {
            console.error("Error loading household members:", error);
        }
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([loadBankConnections(), loadHouseholdMembers()]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleEnableBankingSuccess = async () => {
        toast.success("Bank account connected successfully");
        await loadData();
    };

    const refreshBalance = async (connectionId: string, accountId: string) => {
        setRefreshingBalance(accountId);
        try {
            const response = await bankFetch(
                "/api/enablebanking/account-details",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        bankConnectionId: connectionId,
                        accountId: accountId,
                    }),
                },
            );

            if (response.ok) {
                toast.success("Balance refreshed successfully");
                await loadData();
            } else {
                const data = await response.json();
                throw new Error(data.error || "Failed to refresh balance");
            }
        } catch (error) {
            if (isBankMfaError(error)) {
                setPendingOperation(
                    () => () => refreshBalance(connectionId, accountId),
                );
                setShowMfaDialog(true);
                setRefreshingBalance(null);
                return;
            }
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to refresh balance",
            );
        } finally {
            setRefreshingBalance(null);
        }
    };

    const syncTransactions = async (connectionId: string) => {
        setSyncing(connectionId);
        try {
            const response = await bankFetch(
                "/api/enablebanking/transactions",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bankConnectionId: connectionId }),
                },
            );

            if (response.ok) {
                toast.success("Transactions synced successfully");
            } else {
                throw new Error("Failed to sync transactions");
            }
        } catch (error) {
            if (isBankMfaError(error)) {
                setPendingOperation(() => () => syncTransactions(connectionId));
                setShowMfaDialog(true);
                setSyncing(null);
                return;
            }
            toast.error("Failed to sync transactions");
        } finally {
            setSyncing(null);
        }
    };

    const deleteConnection = async (connectionId: string) => {
        if (!confirm("Are you sure you want to delete this connection?"))
            return;

        try {
            const response = await bankFetch(
                `/api/bank-connections?id=${connectionId}`,
                {
                    method: "DELETE",
                },
            );

            if (response.ok) {
                toast.success("Bank connection deleted");
                await loadData();
            }
        } catch (error) {
            if (isBankMfaError(error)) {
                setPendingOperation(() => () => deleteConnection(connectionId));
                setShowMfaDialog(true);
                return;
            }
            toast.error("Failed to delete connection");
        }
    };

    const handleMfaSuccess = async () => {
        if (pendingOperation) {
            try {
                await pendingOperation();
            } catch {
                toast.error("Operation failed. Please try again.");
            }
            setPendingOperation(null);
        }
        setShowMfaDialog(false);
    };

    const handleTagAccount = async (
        accountId: string,
        accountType: string,
        ownerId?: string,
    ) => {
        try {
            const response = await fetch("/api/bank-accounts/tag", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    accountId,
                    accountType,
                    ownerId: accountType === "personal" ? ownerId : null,
                }),
            });

            if (response.ok) {
                toast.success("Account tagged successfully");
                await loadData();
            } else {
                const data = await response.json();
                toast.error(data.error || "Failed to tag account");
            }
        } catch (error) {
            console.error("Error tagging account:", error);
            toast.error("Failed to tag account");
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
                        <EnableBankingLink
                            onSuccess={handleEnableBankingSuccess}
                        />
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
                                                className="p-3 bg-muted/50 rounded space-y-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium">
                                                            {account.name}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {account.type} •{" "}
                                                            {account.subtype}
                                                        </p>
                                                    </div>
                                                    <div className="text-right flex items-center gap-2">
                                                        <div>
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
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                refreshBalance(
                                                                    connection.id,
                                                                    account.id,
                                                                )
                                                            }
                                                            disabled={
                                                                refreshingBalance ===
                                                                account.id
                                                            }
                                                            title="Refresh balance"
                                                        >
                                                            {refreshingBalance ===
                                                            account.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <RefreshCw className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 pt-2 border-t">
                                                    <div className="flex items-center gap-2">
                                                        <Tag className="h-4 w-4 text-muted-foreground" />
                                                        <Label className="text-sm">
                                                            Account Type:
                                                        </Label>
                                                    </div>
                                                    <Select
                                                        value={
                                                            account.accountType ||
                                                            ""
                                                        }
                                                        onValueChange={(
                                                            value,
                                                        ) => {
                                                            if (
                                                                value ===
                                                                "personal"
                                                            ) {
                                                                const firstMember =
                                                                    householdMembers.find(
                                                                        (m) =>
                                                                            m.isActive,
                                                                    );
                                                                if (
                                                                    firstMember
                                                                ) {
                                                                    handleTagAccount(
                                                                        account.id,
                                                                        value,
                                                                        firstMember.id,
                                                                    );
                                                                } else {
                                                                    toast.error(
                                                                        "Please create a household member first",
                                                                    );
                                                                }
                                                            } else {
                                                                handleTagAccount(
                                                                    account.id,
                                                                    value,
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="w-35">
                                                            <SelectValue placeholder="Select type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="personal">
                                                                Personal
                                                            </SelectItem>
                                                            <SelectItem value="joint">
                                                                Joint
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>

                                                    {account.accountType ===
                                                        "personal" && (
                                                        <>
                                                            <Label className="text-sm">
                                                                Owner:
                                                            </Label>
                                                            <Select
                                                                value={
                                                                    account.ownerId ||
                                                                    ""
                                                                }
                                                                onValueChange={(
                                                                    ownerId,
                                                                ) =>
                                                                    handleTagAccount(
                                                                        account.id,
                                                                        "personal",
                                                                        ownerId,
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger className="w-45">
                                                                    <SelectValue placeholder="Select owner" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {householdMembers
                                                                        .filter(
                                                                            (
                                                                                m,
                                                                            ) =>
                                                                                m.isActive,
                                                                        )
                                                                        .map(
                                                                            (
                                                                                member,
                                                                            ) => (
                                                                                <SelectItem
                                                                                    key={
                                                                                        member.id
                                                                                    }
                                                                                    value={
                                                                                        member.id
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        member.name
                                                                                    }
                                                                                </SelectItem>
                                                                            ),
                                                                        )}
                                                                </SelectContent>
                                                            </Select>
                                                        </>
                                                    )}
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

            <BankMfaDialog
                open={showMfaDialog}
                onOpenChange={setShowMfaDialog}
                onSuccess={handleMfaSuccess}
            />
        </div>
    );
}
