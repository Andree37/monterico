"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, XCircle, Wallet } from "lucide-react";
import { useAccountingMode } from "@/hooks/use-accounting-mode";
import { AccountingModeWarning } from "@/components/AccountingModeIndicator";

interface HouseholdMember {
    id: string;
    name: string;
}

interface Reimbursement {
    id: string;
    userId: string;
    householdMemberId: string;
    month: string;
    amount: number;
    description: string;
    settled: boolean;
    createdAt: string;
    settledAt?: string;
    householdMember: HouseholdMember;
}

export default function ReimbursementsPage() {
    const { isSharedPool } = useAccountingMode();
    const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
    const [loading, setLoading] = useState(true);
    const [settling, setSettling] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "pending" | "settled">("all");

    useEffect(() => {
        loadReimbursements();
    }, []);

    const loadReimbursements = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/reimbursements");
            if (response.ok) {
                const data = await response.json();
                setReimbursements(data.reimbursements || []);
            }
        } catch (error) {
            console.error("Error loading reimbursements:", error);
            toast.error("Failed to load reimbursements");
        } finally {
            setLoading(false);
        }
    };

    const handleSettle = async (reimbursementId: string) => {
        setSettling(reimbursementId);
        try {
            const response = await fetch("/api/reimbursements", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: reimbursementId,
                    settled: true,
                }),
            });

            if (response.ok) {
                await loadReimbursements();
                toast.success("Reimbursement marked as settled");
            } else {
                const data = await response.json();
                toast.error(data.error || "Failed to settle reimbursement");
            }
        } catch (error) {
            console.error("Error settling reimbursement:", error);
            toast.error("An unexpected error occurred");
        } finally {
            setSettling(null);
        }
    };

    const handleUnsettle = async (reimbursementId: string) => {
        setSettling(reimbursementId);
        try {
            const response = await fetch("/api/reimbursements", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: reimbursementId,
                    settled: false,
                }),
            });

            if (response.ok) {
                await loadReimbursements();
                toast.success("Reimbursement marked as pending");
            } else {
                const data = await response.json();
                toast.error(data.error || "Failed to unsettle reimbursement");
            }
        } catch (error) {
            console.error("Error unsettling reimbursement:", error);
            toast.error("An unexpected error occurred");
        } finally {
            setSettling(null);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-IE", {
            style: "currency",
            currency: "EUR",
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-IE", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const formatMonth = (monthStr: string) => {
        const [year, month] = monthStr.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString("en-IE", {
            month: "long",
            year: "numeric",
        });
    };

    const filteredReimbursements = reimbursements.filter((r) => {
        if (filter === "pending") return !r.settled;
        if (filter === "settled") return r.settled;
        return true;
    });

    const pendingReimbursements = reimbursements.filter((r) => !r.settled);
    const totalPending = pendingReimbursements.reduce(
        (sum, r) => sum + r.amount,
        0,
    );

    // Calculate pending reimbursements by user
    const pendingByUser = pendingReimbursements.reduce(
        (acc, r) => {
            if (!acc[r.householdMemberId]) {
                acc[r.householdMemberId] = {
                    userName: r.householdMember.name,
                    total: 0,
                    count: 0,
                };
            }
            acc[r.householdMemberId].total += r.amount;
            acc[r.householdMemberId].count += 1;
            return acc;
        },
        {} as Record<
            string,
            { userName: string; total: number; count: number }
        >,
    );

    if (!isSharedPool()) {
        return (
            <div className="container mx-auto py-8 px-4 max-w-7xl">
                <AccountingModeWarning requiredMode="shared_pool" />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="container mx-auto py-8 px-4 max-w-7xl">
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Pending Reimbursements
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(totalPending)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {pendingReimbursements.length} pending
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Reimbursements
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {reimbursements.length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            All time
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Settled
                        </CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {reimbursements.filter((r) => r.settled).length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Completed
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Breakdown by Person */}
            {Object.keys(pendingByUser).length > 0 && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-lg">
                            Pending by Person
                        </CardTitle>
                        <CardDescription>
                            Amount owed from shared pool to each person
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {Object.entries(pendingByUser).map(
                                ([userId, data]) => (
                                    <div
                                        key={userId}
                                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <span className="text-sm font-semibold text-primary">
                                                    {data.userName
                                                        .substring(0, 2)
                                                        .toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {data.userName}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {data.count} pending{" "}
                                                    {data.count === 1
                                                        ? "reimbursement"
                                                        : "reimbursements"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-orange-600">
                                                {formatCurrency(data.total)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                to be paid
                                            </p>
                                        </div>
                                    </div>
                                ),
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex gap-2 mb-6">
                <Button
                    variant={filter === "all" ? "default" : "outline"}
                    onClick={() => setFilter("all")}
                    size="sm"
                >
                    All
                </Button>
                <Button
                    variant={filter === "pending" ? "default" : "outline"}
                    onClick={() => setFilter("pending")}
                    size="sm"
                >
                    Pending
                </Button>
                <Button
                    variant={filter === "settled" ? "default" : "outline"}
                    onClick={() => setFilter("settled")}
                    size="sm"
                >
                    Settled
                </Button>
            </div>

            {/* Reimbursements List */}
            {filteredReimbursements.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground">
                            No {filter !== "all" && filter} reimbursements found
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {filteredReimbursements.map((reimbursement) => (
                        <Card key={reimbursement.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <CardTitle className="text-lg">
                                            {reimbursement.description}
                                        </CardTitle>
                                        <CardDescription>
                                            {formatMonth(reimbursement.month)}
                                        </CardDescription>
                                        <div className="mt-3 flex items-center gap-2 text-sm">
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-md">
                                                <span className="text-muted-foreground">
                                                    Paid by:
                                                </span>
                                                <span className="font-medium text-blue-900">
                                                    {
                                                        reimbursement
                                                            .householdMember
                                                            .name
                                                    }
                                                </span>
                                            </div>
                                            <span className="text-muted-foreground">
                                                →
                                            </span>
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-md">
                                                <span className="text-muted-foreground">
                                                    Reimburse from:
                                                </span>
                                                <span className="font-medium text-green-900">
                                                    Shared Pool
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold">
                                            {formatCurrency(
                                                reimbursement.amount,
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatMonth(reimbursement.month)}
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">
                                                Created:{" "}
                                                {formatDate(
                                                    reimbursement.createdAt,
                                                )}
                                            </p>
                                            {reimbursement.settled &&
                                                reimbursement.settledAt && (
                                                    <p className="text-sm text-green-600">
                                                        Settled:{" "}
                                                        {formatDate(
                                                            reimbursement.settledAt,
                                                        )}
                                                    </p>
                                                )}
                                        </div>
                                        {reimbursement.settled ? (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Settled
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                                                <XCircle className="h-3 w-3" />
                                                Pending
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        {!reimbursement.settled ? (
                                            <Button
                                                onClick={() =>
                                                    handleSettle(
                                                        reimbursement.id,
                                                    )
                                                }
                                                disabled={
                                                    settling ===
                                                    reimbursement.id
                                                }
                                                size="sm"
                                            >
                                                {settling === reimbursement.id
                                                    ? "Settling..."
                                                    : "Mark as Settled"}
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={() =>
                                                    handleUnsettle(
                                                        reimbursement.id,
                                                    )
                                                }
                                                disabled={
                                                    settling ===
                                                    reimbursement.id
                                                }
                                                variant="outline"
                                                size="sm"
                                            >
                                                {settling === reimbursement.id
                                                    ? "Unsettling..."
                                                    : "Mark as Pending"}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
