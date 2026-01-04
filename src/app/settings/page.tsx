"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, Save, Users, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
            toast({
                title: "Error",
                description: "Name is required",
                type: "error",
            });
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
                toast({
                    title: "Success",
                    description: "User added successfully",
                    type: "success",
                });
            } else {
                toast({
                    title: "Error",
                    description: "Failed to add user",
                    type: "error",
                });
            }
        } catch (error) {
            console.error("Error adding user:", error);
            toast({
                title: "Error",
                description: "Failed to add user",
                type: "error",
            });
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
                toast({
                    title: "Success",
                    description: "User updated successfully",
                    type: "success",
                });
            } else {
                toast({
                    title: "Error",
                    description: "Failed to update user",
                    type: "error",
                });
            }
        } catch (error) {
            console.error("Error updating user:", error);
            toast({
                title: "Error",
                description: "Failed to update user",
                type: "error",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        setSaving(true);
        try {
            const response = await fetch(`/api/users?id=${userId}`, {
                method: "DELETE",
            });

            if (response.ok) {
                await loadData();
                toast({
                    title: "Success",
                    description: "User deactivated successfully",
                    type: "success",
                });
            } else {
                const errorData = await response.json();
                toast({
                    title: "Error",
                    description: errorData.error || "Failed to deactivate user",
                    type: "error",
                });
            }
        } catch (error) {
            console.error("Error deleting user:", error);
            toast({
                title: "Error",
                description:
                    error instanceof Error
                        ? error.message
                        : "Failed to deactivate user",
                type: "error",
            });
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
                    toast({
                        title: "Success",
                        description:
                            data.message ||
                            "Shared pool initialized with existing income data",
                        type: "success",
                    });
                } else {
                    toast({
                        title: "Success",
                        description: "Settings saved successfully",
                        type: "success",
                    });
                }
            } else {
                toast({
                    title: "Error",
                    description: "Failed to save settings",
                    type: "error",
                });
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({
                title: "Error",
                description: "Failed to save settings",
                type: "error",
            });
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
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold mb-2">Settings</h1>
                    <p className="text-muted-foreground">
                        Manage household members and default settings
                    </p>
                </div>

                {/* Users Section */}
                <div className="bg-card border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            <h2 className="text-xl font-semibold">
                                Household Members
                            </h2>
                        </div>
                        <button
                            onClick={() => setShowAddUser(!showAddUser)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                        >
                            <Plus className="h-4 w-4" />
                            Add Member
                        </button>
                    </div>

                    {/* Add User Form */}
                    {showAddUser && (
                        <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                            <h3 className="font-medium mb-4">Add New Member</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <Label className="block mb-2">Name *</Label>
                                    <Input
                                        type="text"
                                        value={newUser.name}
                                        onChange={(e) =>
                                            setNewUser({
                                                ...newUser,
                                                name: e.target.value,
                                            })
                                        }
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div>
                                    <Label className="block mb-2">Email</Label>
                                    <Input
                                        type="email"
                                        value={newUser.email}
                                        onChange={(e) =>
                                            setNewUser({
                                                ...newUser,
                                                email: e.target.value,
                                            })
                                        }
                                        placeholder="john@example.com"
                                    />
                                </div>
                                <div>
                                    <Label className="block mb-2">
                                        Default Ratio
                                    </Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        value={newUser.ratio}
                                        onChange={(e) =>
                                            setNewUser({
                                                ...newUser,
                                                ratio: parseFloat(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                        placeholder="0.5"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={handleAddUser}
                                    disabled={saving}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {saving ? "Adding..." : "Add Member"}
                                </button>
                                <button
                                    onClick={() => setShowAddUser(false)}
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
                                className={`p-4 border rounded-lg ${
                                    !user.isActive
                                        ? "opacity-50 bg-muted/30"
                                        : ""
                                }`}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                                    <div>
                                        <Label className="block mb-1">
                                            Name
                                        </Label>
                                        <Input
                                            type="text"
                                            value={user.name}
                                            onChange={(e) =>
                                                handleUpdateUser(user.id, {
                                                    name: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <Label className="block mb-1">
                                            Email
                                        </Label>
                                        <Input
                                            type="email"
                                            value={user.email || ""}
                                            onChange={(e) =>
                                                handleUpdateUser(user.id, {
                                                    email: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <Label className="block mb-1">
                                            Split Ratio
                                        </Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="1"
                                            value={user.ratio}
                                            onChange={(e) =>
                                                handleUpdateUser(user.id, {
                                                    ratio: parseFloat(
                                                        e.target.value,
                                                    ),
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <button
                                            onClick={() =>
                                                handleUpdateUser(user.id, {
                                                    isActive: !user.isActive,
                                                })
                                            }
                                            className={`flex-1 px-3 py-2 border rounded ${
                                                user.isActive
                                                    ? "bg-green-50 border-green-300 text-green-700"
                                                    : "bg-red-50 border-red-300 text-red-700"
                                            }`}
                                        >
                                            {user.isActive
                                                ? "Active"
                                                : "Inactive"}
                                        </button>
                                        {user.isActive && (
                                            <button
                                                onClick={() =>
                                                    handleDeleteUser(user.id)
                                                }
                                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                title="Deactivate member"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Ratio Summary */}
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">
                                    Total Ratio
                                </p>
                                <p className="text-2xl font-bold">
                                    {totalRatio.toFixed(2)}
                                </p>
                            </div>
                            {totalRatio !== 1.0 && (
                                <button
                                    onClick={normalizeRatios}
                                    className="px-4 py-2 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded hover:bg-yellow-200"
                                >
                                    Normalize to 1.0
                                </button>
                            )}
                        </div>
                        {totalRatio !== 1.0 && (
                            <p className="text-sm text-muted-foreground mt-2">
                                Ratios should sum to 1.0 for accurate splits
                            </p>
                        )}
                    </div>
                </div>

                {/* Accounting Mode */}
                <div className="bg-card border rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">
                        Accounting Mode
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">
                        Choose how your household manages finances
                    </p>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Individual Accounts Mode */}
                            <div
                                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                    settings.accountingMode === "individual"
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                }`}
                                onClick={() =>
                                    setSettings({
                                        ...settings,
                                        accountingMode: "individual",
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
                                                accountingMode: "individual",
                                            })
                                        }
                                        className="mt-1"
                                    />
                                    <div>
                                        <h3 className="font-semibold">
                                            Individual Accounts
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Separate accounts, debt tracking
                                        </p>
                                    </div>
                                </div>
                                <div className="ml-6 text-xs text-muted-foreground space-y-1">
                                    <p>• Each person keeps their own salary</p>
                                    <p>• Shared expenses split by ratio</p>
                                    <p>• Track who owes whom</p>
                                </div>
                            </div>

                            {/* Shared Pool Mode */}
                            <div
                                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                    settings.accountingMode === "shared_pool"
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                }`}
                                onClick={() =>
                                    setSettings({
                                        ...settings,
                                        accountingMode: "shared_pool",
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
                                                accountingMode: "shared_pool",
                                            })
                                        }
                                        className="mt-1"
                                    />
                                    <div>
                                        <h3 className="font-semibold">
                                            Shared Pool
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Joint finances, personal allowances
                                        </p>
                                    </div>
                                </div>
                                <div className="ml-6 text-xs text-muted-foreground space-y-1">
                                    <p>• All income goes to shared pool</p>
                                    <p>• Personal allowances allocated</p>
                                    <p>• Track pool balance & reimbursements</p>
                                </div>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
                            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                            <div className="text-xs text-blue-900">
                                <p className="font-medium mb-1">
                                    Not sure which mode to use?
                                </p>
                                <p>
                                    <strong>Individual Accounts:</strong> Best
                                    for separate finances with expense
                                    splitting.
                                </p>
                                <p className="mt-1">
                                    <strong>Shared Pool:</strong> Best for joint
                                    finances with one shared account.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Personal Allowance Configuration - Only show in Shared Pool mode */}
                {settings.accountingMode === "shared_pool" && (
                    <div className="bg-card border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-2">
                            Personal Allowance Configuration
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            Configure how much each person receives as personal
                            spending money from household income
                        </p>

                        <div className="space-y-4">
                            {users
                                .filter((u) => u.isActive)
                                .map((user) => {
                                    const config = allowanceConfigs.find(
                                        (c) => c.userId === user.id,
                                    );
                                    const editing = editingAllowance[user.id];
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
                                                    {user.name}
                                                </h3>
                                                {config && !editing && (
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
                                                    <select
                                                        value={displayType}
                                                        onChange={(e) =>
                                                            setEditingAllowance(
                                                                {
                                                                    ...editingAllowance,
                                                                    [user.id]: {
                                                                        type: e
                                                                            .target
                                                                            .value,
                                                                        value: displayValue,
                                                                    },
                                                                },
                                                            )
                                                        }
                                                        className="w-full p-2 border rounded text-sm"
                                                    >
                                                        <option value="percentage">
                                                            Percentage
                                                        </option>
                                                        <option value="fixed">
                                                            Fixed Amount
                                                        </option>
                                                    </select>
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
                                                        value={displayValue}
                                                        onChange={(e) =>
                                                            setEditingAllowance(
                                                                {
                                                                    ...editingAllowance,
                                                                    [user.id]: {
                                                                        type: displayType,
                                                                        value: e
                                                                            .target
                                                                            .value,
                                                                    },
                                                                },
                                                            )
                                                        }
                                                        className="text-sm"
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
                                                            ) * 100
                                                        ).toFixed(0)}
                                                        % of income (after fixed
                                                        allocations)
                                                    </p>
                                                ) : (
                                                    <p>
                                                        Fixed €
                                                        {parseFloat(
                                                            displayValue,
                                                        ).toFixed(2)}{" "}
                                                        per income
                                                    </p>
                                                )}
                                            </div>

                                            {editing && (
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={async () => {
                                                            setSaving(true);
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
                                                                        user.id
                                                                    ];
                                                                    setEditingAllowance(
                                                                        newEditing,
                                                                    );
                                                                    toast({
                                                                        title: "Success",
                                                                        description:
                                                                            "Allowance configuration saved",
                                                                        type: "success",
                                                                    });
                                                                } else {
                                                                    toast({
                                                                        title: "Error",
                                                                        description:
                                                                            "Failed to save configuration",
                                                                        type: "error",
                                                                    });
                                                                }
                                                            } catch (error) {
                                                                console.error(
                                                                    error,
                                                                );
                                                                toast({
                                                                    title: "Error",
                                                                    description:
                                                                        "An error occurred",
                                                                    type: "error",
                                                                });
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
                                                            const newEditing = {
                                                                ...editingAllowance,
                                                            };
                                                            delete newEditing[
                                                                user.id
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

                                            {!editing && config && (
                                                <button
                                                    onClick={() =>
                                                        setEditingAllowance({
                                                            ...editingAllowance,
                                                            [user.id]: {
                                                                type: config.type,
                                                                value: config.value.toString(),
                                                            },
                                                        })
                                                    }
                                                    className="mt-3 px-3 py-1 text-xs border rounded hover:bg-muted"
                                                >
                                                    Edit
                                                </button>
                                            )}

                                            {!editing && !config && (
                                                <button
                                                    onClick={() =>
                                                        setEditingAllowance({
                                                            ...editingAllowance,
                                                            [user.id]: {
                                                                type: "percentage",
                                                                value: "0.2",
                                                            },
                                                        })
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
                                When income is added without configuration, each
                                person automatically gets 20% as personal
                                allowance. The remainder goes to the shared
                                pool.
                            </p>
                        </div>
                    </div>
                )}

                {/* General Settings */}
                <div className="bg-card border rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-6">
                        Default Settings
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium block mb-2">
                                Default Paid By
                            </label>
                            <select
                                value={settings.defaultPaidBy || ""}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        defaultPaidBy: e.target.value || null,
                                    })
                                }
                                className="w-full p-2 border rounded"
                            >
                                <option value="">None</option>
                                {users
                                    .filter((u) => u.isActive)
                                    .map((user) => (
                                        <option key={user.id} value={user.id}>
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
                                        defaultType: e.target.value,
                                    })
                                }
                                className="w-full p-2 border rounded"
                            >
                                <option value="shared">Shared</option>
                                <option value="personal">Personal</option>
                            </select>
                        </div>

                        {settings.accountingMode === "individual" && (
                            <div>
                                <label className="text-sm font-medium block mb-2">
                                    Default Split Type
                                </label>
                                <select
                                    value={settings.defaultSplitType}
                                    onChange={(e) =>
                                        setSettings({
                                            ...settings,
                                            defaultSplitType: e.target.value,
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="equal">Equal Split</option>
                                    <option value="ratio">By Ratio</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                        )}

                        <button
                            onClick={handleSaveSettings}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {saving ? "Saving..." : "Save Settings"}
                        </button>
                    </div>
                </div>

                {/* Back to Expenses */}
                <div className="text-center">
                    <a
                        href="/expenses"
                        className="text-primary hover:underline"
                    >
                        ← Back to Expenses
                    </a>
                </div>
            </div>
        </div>
    );
}
