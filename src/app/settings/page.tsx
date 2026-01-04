"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, Save, Users } from "lucide-react";
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

interface Settings {
    defaultPaidBy: string | null;
    defaultType: string;
    defaultSplitType: string;
}

export default function SettingsPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [settings, setSettings] = useState<Settings>({
        defaultPaidBy: null,
        defaultType: "shared",
        defaultSplitType: "equal",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newUser, setNewUser] = useState({
        name: "",
        email: "",
        ratio: 0.5,
    });
    const [showAddUser, setShowAddUser] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [usersRes, settingsRes] = await Promise.all([
                fetch("/api/users"),
                fetch("/api/settings"),
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
                toast({
                    title: "Success",
                    description: "Settings saved successfully",
                    type: "success",
                });
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
