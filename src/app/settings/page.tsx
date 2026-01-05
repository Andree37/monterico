"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Info, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TabsContainer, TabIcons } from "@/components/layout/TabsContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface User {
    id: string;
    name: string;
    email: string | null;
    ratio: number;
    isActive: boolean;
}

interface UserAllowanceConfig {
    id: string;
    userId: string;
    type: "percentage" | "fixed";
    value: number;
    isActive: boolean;
    user?: User;
}

interface Settings {
    defaultPaidBy: string | null;
    defaultType: string;
    defaultSplitType: string;
    accountingMode: string;
}

export default function SettingsPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [settings, setSettings] = useState<Settings>({
        defaultPaidBy: null,
        defaultType: "shared",
        defaultSplitType: "equal",
        accountingMode: "individual",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newUser, setNewUser] = useState({
        name: "",
        email: "",
        ratio: 0.5,
    });
    const [showAddUser, setShowAddUser] = useState(false);
    const [allowanceConfigs, setAllowanceConfigs] = useState<
        UserAllowanceConfig[]
    >([]);
    const [editingAllowance, setEditingAllowance] = useState<{
        [userId: string]: { type: string; value: string };
    }>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [usersRes, settingsRes, configsRes] = await Promise.all([
                fetch("/api/users"),
                fetch("/api/settings"),
                fetch("/api/user-allowance-config"),
            ]);

            if (usersRes.ok) {
                const usersData = await usersRes.json();
                setUsers(usersData);
            }

            if (settingsRes.ok) {
                const settingsData = await settingsRes.json();
                if (settingsData.settings) {
                    setSettings(settingsData.settings);
                }
            }

            if (configsRes.ok) {
                const configsData = await configsRes.json();
                if (configsData.success) {
                    setAllowanceConfigs(configsData.configs || []);
                }
            }
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async () => {
        if (!newUser.name) {
            toast.error("Name is required");
            return;
        }

        setSaving(true);
        try {
            const response = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newUser),
            });

            if (response.ok) {
                setNewUser({ name: "", email: "", ratio: 0.5 });
                setShowAddUser(false);
                await loadData();
                toast.success("User added successfully");
            } else {
                toast.error("Failed to add user");
            }
        } catch (error) {
            console.error("Error adding user:", error);
            toast.error("Failed to add user");
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
        setSaving(true);
        try {
            const response = await fetch("/api/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: userId, ...updates }),
            });

            if (response.ok) {
                await loadData();
                toast.success("User updated successfully");
            } else {
                toast.error("Failed to update user");
            }
        } catch (error) {
            console.error("Error updating user:", error);
            toast.error("Failed to update user");
        } finally {
            setSaving(false);
        }
    };

    const _handleDeleteUser = async (userId: string) => {
        setSaving(true);
        try {
            const response = await fetch(`/api/users?id=${userId}`, {
                method: "DELETE",
            });

            if (response.ok) {
                await loadData();
                toast.success("User deactivated successfully");
            } else {
                const errorData = await response.json();
                toast.error(errorData.error || "Failed to deactivate user");
            }
        } catch (error) {
            console.error("Error deleting user:", error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to deactivate user",
            );
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            const response = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (response.ok) {
                const data = await response.json();

                if (data.poolInitialized) {
                    toast.success(
                        data.message ||
                            "Shared pool initialized with existing income data",
                    );
                } else {
                    toast.success("Settings saved successfully");
                }

                // Notify other components that accounting mode changed
                window.dispatchEvent(new Event("accounting-mode-changed"));
            } else {
                toast.error("Failed to save settings");
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const normalizeRatios = () => {
        const activeUsers = users.filter((u) => u.isActive);
        const totalRatio = activeUsers.reduce((sum, u) => sum + u.ratio, 0);

        if (totalRatio === 0) return;

        const normalized = users.map((user) => ({
            ...user,
            ratio: user.isActive ? user.ratio / totalRatio : user.ratio,
        }));

        setUsers(normalized);
    };

    const totalRatio = users
        .filter((u) => u.isActive)
        .reduce((sum, u) => sum + u.ratio, 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-8">
                <div className="max-w-4xl mx-auto">
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <TabsContainer
                    defaultValue="members"
                    tabs={[
                        {
                            value: "members",
                            label: "Members",
                            icon: <TabIcons.Users className="h-4 w-4" />,
                            content: (
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle>
                                                Household Members
                                            </CardTitle>
                                            <button
                                                onClick={() =>
                                                    setShowAddUser(!showAddUser)
                                                }
                                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Add Member
                                            </button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {/* Add User Form */}
                                        {showAddUser && (
                                            <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                                                <h3 className="font-medium mb-4">
                                                    Add New Member
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div>
                                                        <Label className="block mb-2">
                                                            Name *
                                                        </Label>
                                                        <Input
                                                            type="text"
                                                            value={newUser.name}
                                                            onChange={(e) =>
                                                                setNewUser({
                                                                    ...newUser,
                                                                    name: e
                                                                        .target
                                                                        .value,
                                                                })
                                                            }
                                                            placeholder="John Doe"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="block mb-2">
                                                            Email
                                                        </Label>
                                                        <Input
                                                            type="email"
                                                            value={
                                                                newUser.email
                                                            }
                                                            onChange={(e) =>
                                                                setNewUser({
                                                                    ...newUser,
                                                                    email: e
                                                                        .target
                                                                        .value,
                                                                })
                                                            }
                                                            placeholder="john@example.com"
                                                        />
                                                    </div>
                                                    {settings.accountingMode ===
                                                        "individual" && (
                                                        <div>
                                                            <Label className="block mb-2">
                                                                Default Ratio
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max="1"
                                                                value={
                                                                    newUser.ratio
                                                                }
                                                                onChange={(e) =>
                                                                    setNewUser({
                                                                        ...newUser,
                                                                        ratio: parseFloat(
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        ),
                                                                    })
                                                                }
                                                                placeholder="0.5"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 mt-4">
                                                    <button
                                                        onClick={handleAddUser}
                                                        disabled={saving}
                                                        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                                                    >
                                                        {saving
                                                            ? "Adding..."
                                                            : "Add Member"}
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setShowAddUser(
                                                                false,
                                                            )
                                                        }
                                                        className="px-4 py-2 border rounded hover:bg-muted"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Users List */}
                                        <div className="space-y-4">
                                            {users.map((user) => (
                                                <div
                                                    key={user.id}
                                                    className={`p-4 border rounded-lg ${!user.isActive ? "opacity-60 bg-muted/30" : ""}`}
                                                >
                                                    <div
                                                        className={`grid gap-4 items-center ${
                                                            settings.accountingMode ===
                                                            "individual"
                                                                ? "grid-cols-1 md:grid-cols-[1fr_1fr_auto_minmax(150px,auto)]"
                                                                : "grid-cols-1 md:grid-cols-[1fr_1fr_minmax(150px,auto)]"
                                                        }`}
                                                    >
                                                        <div>
                                                            <Label className="block mb-1">
                                                                Name
                                                            </Label>
                                                            <Input
                                                                type="text"
                                                                value={
                                                                    user.name
                                                                }
                                                                onChange={(e) =>
                                                                    handleUpdateUser(
                                                                        user.id,
                                                                        {
                                                                            name: e
                                                                                .target
                                                                                .value,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="block mb-1">
                                                                Email
                                                            </Label>
                                                            <Input
                                                                type="email"
                                                                value={
                                                                    user.email ||
                                                                    ""
                                                                }
                                                                onChange={(e) =>
                                                                    handleUpdateUser(
                                                                        user.id,
                                                                        {
                                                                            email: e
                                                                                .target
                                                                                .value,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                        {settings.accountingMode ===
                                                            "individual" && (
                                                            <div>
                                                                <Label className="block mb-1">
                                                                    Split Ratio
                                                                </Label>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max="1"
                                                                    value={
                                                                        user.ratio
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        handleUpdateUser(
                                                                            user.id,
                                                                            {
                                                                                ratio: parseFloat(
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                ),
                                                                            },
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <Label className="block mb-1">
                                                                Status
                                                            </Label>
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className={`text-sm font-medium ${user.isActive ? "text-green-600" : "text-muted-foreground"}`}
                                                                >
                                                                    {user.isActive
                                                                        ? "Enabled"
                                                                        : "Disabled"}
                                                                </span>
                                                                <Button
                                                                    variant={
                                                                        user.isActive
                                                                            ? "default"
                                                                            : "outline"
                                                                    }
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        handleUpdateUser(
                                                                            user.id,
                                                                            {
                                                                                isActive:
                                                                                    !user.isActive,
                                                                            },
                                                                        )
                                                                    }
                                                                >
                                                                    {user.isActive
                                                                        ? "Disable"
                                                                        : "Enable"}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Ratio Summary */}
                                        {settings.accountingMode ===
                                            "individual" && (
                                            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium">
                                                            Total Ratio
                                                        </p>
                                                        <p className="text-2xl font-bold">
                                                            {totalRatio.toFixed(
                                                                2,
                                                            )}
                                                        </p>
                                                    </div>
                                                    {totalRatio !== 1.0 && (
                                                        <button
                                                            onClick={
                                                                normalizeRatios
                                                            }
                                                            className="px-4 py-2 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded hover:bg-yellow-200"
                                                        >
                                                            Normalize to 1.0
                                                        </button>
                                                    )}
                                                </div>
                                                {totalRatio !== 1.0 && (
                                                    <p className="text-sm text-muted-foreground mt-2">
                                                        Ratios should sum to 1.0
                                                        for accurate splits
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ),
                        },
                        {
                            value: "accounting",
                            label: "Accounting Mode",
                            icon: <TabIcons.Settings className="h-4 w-4" />,
                            content: (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Accounting Mode</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground mb-6">
                                            Choose how your household manages
                                            finances
                                        </p>

                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Individual Accounts Mode */}
                                                <div
                                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                                        settings.accountingMode ===
                                                        "individual"
                                                            ? "border-primary bg-primary/5"
                                                            : "border-border hover:border-primary/50"
                                                    }`}
                                                    onClick={() =>
                                                        setSettings({
                                                            ...settings,
                                                            accountingMode:
                                                                "individual",
                                                        })
                                                    }
                                                >
                                                    <div className="flex items-start gap-2 mb-2">
                                                        <input
                                                            type="radio"
                                                            checked={
                                                                settings.accountingMode ===
                                                                "individual"
                                                            }
                                                            onChange={() =>
                                                                setSettings({
                                                                    ...settings,
                                                                    accountingMode:
                                                                        "individual",
                                                                })
                                                            }
                                                            className="mt-1"
                                                        />
                                                        <div>
                                                            <h3 className="font-semibold">
                                                                Individual
                                                                Accounts
                                                            </h3>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                Separate
                                                                accounts, debt
                                                                tracking
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="ml-6 text-xs text-muted-foreground space-y-1">
                                                        <p>
                                                            • Each person keeps
                                                            their own salary
                                                        </p>
                                                        <p>
                                                            • Shared expenses
                                                            split by ratio
                                                        </p>
                                                        <p>
                                                            • Track who owes
                                                            whom
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Shared Pool Mode */}
                                                <div
                                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                                        settings.accountingMode ===
                                                        "shared_pool"
                                                            ? "border-primary bg-primary/5"
                                                            : "border-border hover:border-primary/50"
                                                    }`}
                                                    onClick={() =>
                                                        setSettings({
                                                            ...settings,
                                                            accountingMode:
                                                                "shared_pool",
                                                        })
                                                    }
                                                >
                                                    <div className="flex items-start gap-2 mb-2">
                                                        <input
                                                            type="radio"
                                                            checked={
                                                                settings.accountingMode ===
                                                                "shared_pool"
                                                            }
                                                            onChange={() =>
                                                                setSettings({
                                                                    ...settings,
                                                                    accountingMode:
                                                                        "shared_pool",
                                                                })
                                                            }
                                                            className="mt-1"
                                                        />
                                                        <div>
                                                            <h3 className="font-semibold">
                                                                Shared Pool
                                                            </h3>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                Joint finances,
                                                                personal
                                                                allowances
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="ml-6 text-xs text-muted-foreground space-y-1">
                                                        <p>
                                                            • All income goes to
                                                            shared pool
                                                        </p>
                                                        <p>
                                                            • Personal
                                                            allowances allocated
                                                        </p>
                                                        <p>
                                                            • Track pool balance
                                                            & reimbursements
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Info Box */}
                                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
                                                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                                <div className="text-xs text-blue-900">
                                                    <p className="font-medium mb-1">
                                                        Not sure which mode to
                                                        use?
                                                    </p>
                                                    <p>
                                                        <strong>
                                                            Individual Accounts:
                                                        </strong>{" "}
                                                        Best for separate
                                                        finances with expense
                                                        splitting.
                                                    </p>
                                                    <p className="mt-1">
                                                        <strong>
                                                            Shared Pool:
                                                        </strong>{" "}
                                                        Best for joint finances
                                                        with one shared account.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ),
                        },
                        {
                            value: "allowances",
                            label: "Allowances",
                            icon: <TabIcons.Wallet className="h-4 w-4" />,
                            content:
                                settings.accountingMode === "shared_pool" ? (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>
                                                Personal Allowance Configuration
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground mb-6">
                                                Configure how much each person
                                                receives as personal spending
                                                money from household income
                                            </p>

                                            <div className="space-y-4">
                                                {users
                                                    .filter((u) => u.isActive)
                                                    .map((user) => {
                                                        const config =
                                                            allowanceConfigs.find(
                                                                (c) =>
                                                                    c.userId ===
                                                                    user.id,
                                                            );
                                                        const editing =
                                                            editingAllowance[
                                                                user.id
                                                            ];
                                                        const displayType =
                                                            editing?.type ||
                                                            config?.type ||
                                                            "percentage";
                                                        const displayValue =
                                                            editing?.value ||
                                                            config?.value?.toString() ||
                                                            "0.2";

                                                        return (
                                                            <div
                                                                key={user.id}
                                                                className="p-4 border rounded-lg"
                                                            >
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <h3 className="font-medium">
                                                                        {
                                                                            user.name
                                                                        }
                                                                    </h3>
                                                                    {config &&
                                                                        !editing && (
                                                                            <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                                                                                Configured
                                                                            </span>
                                                                        )}
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div>
                                                                        <Label className="text-xs mb-1 block">
                                                                            Type
                                                                        </Label>
                                                                        <Select
                                                                            value={
                                                                                displayType
                                                                            }
                                                                            onValueChange={(
                                                                                value: string,
                                                                            ) =>
                                                                                setEditingAllowance(
                                                                                    {
                                                                                        ...editingAllowance,
                                                                                        [user.id]:
                                                                                            {
                                                                                                type: value,
                                                                                                value: displayValue,
                                                                                            },
                                                                                    },
                                                                                )
                                                                            }
                                                                        >
                                                                            <SelectTrigger className="h-9 text-sm">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="percentage">
                                                                                    Percentage
                                                                                </SelectItem>
                                                                                <SelectItem value="fixed">
                                                                                    Fixed
                                                                                    Amount
                                                                                </SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>

                                                                    <div>
                                                                        <Label className="text-xs mb-1 block">
                                                                            {displayType ===
                                                                            "percentage"
                                                                                ? "Percentage (0-1)"
                                                                                : "Amount (€)"}
                                                                        </Label>
                                                                        <Input
                                                                            type="number"
                                                                            step={
                                                                                displayType ===
                                                                                "percentage"
                                                                                    ? "0.01"
                                                                                    : "1"
                                                                            }
                                                                            min="0"
                                                                            max={
                                                                                displayType ===
                                                                                "percentage"
                                                                                    ? "1"
                                                                                    : undefined
                                                                            }
                                                                            value={
                                                                                displayValue
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                setEditingAllowance(
                                                                                    {
                                                                                        ...editingAllowance,
                                                                                        [user.id]:
                                                                                            {
                                                                                                type: displayType,
                                                                                                value: e
                                                                                                    .target
                                                                                                    .value,
                                                                                            },
                                                                                    },
                                                                                )
                                                                            }
                                                                            className="h-9 text-sm"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="mt-2 text-xs text-muted-foreground">
                                                                    {displayType ===
                                                                    "percentage" ? (
                                                                        <p>
                                                                            {(
                                                                                parseFloat(
                                                                                    displayValue,
                                                                                ) *
                                                                                100
                                                                            ).toFixed(
                                                                                0,
                                                                            )}
                                                                            % of
                                                                            income
                                                                            (after
                                                                            fixed
                                                                            allocations)
                                                                        </p>
                                                                    ) : (
                                                                        <p>
                                                                            Fixed
                                                                            €
                                                                            {parseFloat(
                                                                                displayValue,
                                                                            ).toFixed(
                                                                                2,
                                                                            )}{" "}
                                                                            per
                                                                            income
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                {editing && (
                                                                    <div className="flex gap-2 mt-3">
                                                                        <button
                                                                            onClick={async () => {
                                                                                setSaving(
                                                                                    true,
                                                                                );
                                                                                try {
                                                                                    const response =
                                                                                        await fetch(
                                                                                            "/api/user-allowance-config",
                                                                                            {
                                                                                                method: "POST",
                                                                                                headers:
                                                                                                    {
                                                                                                        "Content-Type":
                                                                                                            "application/json",
                                                                                                    },
                                                                                                body: JSON.stringify(
                                                                                                    {
                                                                                                        userId: user.id,
                                                                                                        type: editing.type,
                                                                                                        value: parseFloat(
                                                                                                            editing.value,
                                                                                                        ),
                                                                                                    },
                                                                                                ),
                                                                                            },
                                                                                        );

                                                                                    if (
                                                                                        response.ok
                                                                                    ) {
                                                                                        await loadData();
                                                                                        const newEditing =
                                                                                            {
                                                                                                ...editingAllowance,
                                                                                            };
                                                                                        delete newEditing[
                                                                                            user
                                                                                                .id
                                                                                        ];
                                                                                        setEditingAllowance(
                                                                                            newEditing,
                                                                                        );
                                                                                        toast.success(
                                                                                            "Allowance configuration saved",
                                                                                        );
                                                                                    } else {
                                                                                        toast.error(
                                                                                            "Failed to save configuration",
                                                                                        );
                                                                                    }
                                                                                } catch (error) {
                                                                                    console.error(
                                                                                        error,
                                                                                    );
                                                                                    toast.error(
                                                                                        "An error occurred",
                                                                                    );
                                                                                } finally {
                                                                                    setSaving(
                                                                                        false,
                                                                                    );
                                                                                }
                                                                            }}
                                                                            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                                                                        >
                                                                            Save
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const newEditing =
                                                                                    {
                                                                                        ...editingAllowance,
                                                                                    };
                                                                                delete newEditing[
                                                                                    user
                                                                                        .id
                                                                                ];
                                                                                setEditingAllowance(
                                                                                    newEditing,
                                                                                );
                                                                            }}
                                                                            className="px-3 py-1 text-xs border rounded hover:bg-muted"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {!editing &&
                                                                    config && (
                                                                        <button
                                                                            onClick={() =>
                                                                                setEditingAllowance(
                                                                                    {
                                                                                        ...editingAllowance,
                                                                                        [user.id]:
                                                                                            {
                                                                                                type: config.type,
                                                                                                value: config.value.toString(),
                                                                                            },
                                                                                    },
                                                                                )
                                                                            }
                                                                            className="mt-3 px-3 py-1 text-xs border rounded hover:bg-muted"
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                    )}

                                                                {!editing &&
                                                                    !config && (
                                                                        <button
                                                                            onClick={() =>
                                                                                setEditingAllowance(
                                                                                    {
                                                                                        ...editingAllowance,
                                                                                        [user.id]:
                                                                                            {
                                                                                                type: "percentage",
                                                                                                value: "0.2",
                                                                                            },
                                                                                    },
                                                                                )
                                                                            }
                                                                            className="mt-3 px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                                                                        >
                                                                            Configure
                                                                        </button>
                                                                    )}
                                                            </div>
                                                        );
                                                    })}
                                            </div>

                                            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs">
                                                <p className="font-medium mb-1">
                                                    Default: 20% per person
                                                </p>
                                                <p className="text-muted-foreground">
                                                    When income is added without
                                                    configuration, each person
                                                    automatically gets 20% as
                                                    personal allowance. The
                                                    remainder goes to the shared
                                                    pool.
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="text-center text-muted-foreground py-8">
                                                <TabIcons.Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                <p>
                                                    Personal allowances are only
                                                    available in Shared Pool
                                                    mode.
                                                </p>
                                                <p className="text-sm mt-2">
                                                    Switch to Shared Pool mode
                                                    in the Accounting Mode tab
                                                    to configure allowances.
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ),
                        },
                        {
                            value: "defaults",
                            label: "Defaults",
                            icon: <SettingsIcon className="h-4 w-4" />,
                            content: (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Default Settings</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-sm font-medium block mb-2">
                                                    Default Paid By
                                                </label>
                                                <select
                                                    value={
                                                        settings.defaultPaidBy ||
                                                        ""
                                                    }
                                                    onChange={(e) =>
                                                        setSettings({
                                                            ...settings,
                                                            defaultPaidBy:
                                                                e.target
                                                                    .value ||
                                                                null,
                                                        })
                                                    }
                                                    className="w-full p-2 border rounded"
                                                >
                                                    <option value="">
                                                        None
                                                    </option>
                                                    {users
                                                        .filter(
                                                            (u) => u.isActive,
                                                        )
                                                        .map((user) => (
                                                            <option
                                                                key={user.id}
                                                                value={user.id}
                                                            >
                                                                {user.name}
                                                            </option>
                                                        ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium block mb-2">
                                                    Default Expense Type
                                                </label>
                                                <select
                                                    value={settings.defaultType}
                                                    onChange={(e) =>
                                                        setSettings({
                                                            ...settings,
                                                            defaultType:
                                                                e.target.value,
                                                        })
                                                    }
                                                    className="w-full p-2 border rounded"
                                                >
                                                    <option value="shared">
                                                        Shared
                                                    </option>
                                                    <option value="personal">
                                                        Personal
                                                    </option>
                                                </select>
                                            </div>

                                            {settings.accountingMode ===
                                                "individual" && (
                                                <div>
                                                    <label className="text-sm font-medium block mb-2">
                                                        Default Split Type
                                                    </label>
                                                    <select
                                                        value={
                                                            settings.defaultSplitType
                                                        }
                                                        onChange={(e) =>
                                                            setSettings({
                                                                ...settings,
                                                                defaultSplitType:
                                                                    e.target
                                                                        .value,
                                                            })
                                                        }
                                                        className="w-full p-2 border rounded"
                                                    >
                                                        <option value="equal">
                                                            Equal Split
                                                        </option>
                                                        <option value="ratio">
                                                            By Ratio
                                                        </option>
                                                        <option value="custom">
                                                            Custom
                                                        </option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ),
                        },
                    ]}
                />

                {/* Save Button - Fixed at bottom */}
                <div className="mt-6 flex justify-end">
                    <Button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        size="lg"
                        className="flex items-center gap-2"
                    >
                        <Save className="h-4 w-4" />
                        {saving ? "Saving..." : "Save Settings"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
