"use client";

import { useEffect, useState, useCallback } from "react";
import {
    getEndpoint,
    isFeatureEnabled,
    shouldShowUIElement,
    type AccountingMode,
    type ModeConfig,
} from "@/lib/accounting-mode-config";

interface Settings {
    accountingMode: "individual" | "shared_pool";
    defaultType: string;
    defaultSplitType: string;
}

export function useAccountingMode() {
    const [accountingMode, setAccountingMode] =
        useState<AccountingMode>("individual");
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<Settings | null>(null);

    const loadSettings = useCallback(async () => {
        try {
            const response = await fetch("/api/settings");
            if (!response.ok) {
                setLoading(false);
                return;
            }

            const contentType = response.headers.get("content-type");
            if (!contentType?.includes("application/json")) {
                setLoading(false);
                return;
            }

            const data = await response.json();
            if (data.success) {
                const settingsData: Settings = {
                    accountingMode: data.accountingMode || "individual",
                    defaultType: data.userSettings?.defaultType || "shared",
                    defaultSplitType:
                        data.userSettings?.defaultSplitType || "equal",
                };
                setSettings(settingsData);
                setAccountingMode(data.accountingMode || "individual");
            }
        } catch (error) {
            console.error("Error loading accounting mode:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSettings();

        // Listen for settings changes
        const handleSettingsChange = () => {
            loadSettings();
        };

        window.addEventListener(
            "accounting-mode-changed",
            handleSettingsChange,
        );

        return () => {
            window.removeEventListener(
                "accounting-mode-changed",
                handleSettingsChange,
            );
        };
    }, [loadSettings]);

    const getExpenseEndpoint = () => {
        return getEndpoint(accountingMode, "expenses");
    };

    const getIncomeEndpoint = () => {
        return getEndpoint(accountingMode, "income");
    };

    const isSharedPool = () => accountingMode === "shared_pool";
    const isIndividual = () => accountingMode === "individual";

    const hasFeature = (feature: keyof ModeConfig["features"]) => {
        return isFeatureEnabled(accountingMode, feature);
    };

    const showUI = (element: keyof ModeConfig["ui"]) => {
        return shouldShowUIElement(accountingMode, element);
    };

    return {
        accountingMode,
        settings,
        loading,
        getExpenseEndpoint,
        getIncomeEndpoint,
        isSharedPool,
        isIndividual,
        hasFeature,
        showUI,
        refetch: loadSettings,
    };
}
