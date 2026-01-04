"use client";

import { useEffect, useState } from "react";
import {
    getModeConfig,
    getEndpoint,
    isFeatureEnabled,
    shouldShowUIElement,
    type AccountingMode,
    type ModeConfig,
} from "@/lib/accounting-mode-config";

interface Settings {
    accountingMode: "individual" | "shared_pool";
    defaultPaidBy: string | null;
    defaultType: string;
    defaultSplitType: string;
}

export function useAccountingMode() {
    const [accountingMode, setAccountingMode] =
        useState<AccountingMode>("individual");
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [config, setConfig] = useState<ModeConfig | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        if (accountingMode) {
            setConfig(getModeConfig(accountingMode));
        }
    }, [accountingMode]);

    const loadSettings = async () => {
        try {
            const response = await fetch("/api/settings");
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.settings) {
                    setSettings(data.settings);
                    setAccountingMode(
                        data.settings.accountingMode || "individual",
                    );
                }
            }
        } catch (error) {
            console.error("Error loading accounting mode:", error);
        } finally {
            setLoading(false);
        }
    };

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
        config,
        getExpenseEndpoint,
        getIncomeEndpoint,
        isSharedPool,
        isIndividual,
        hasFeature,
        showUI,
        refetch: loadSettings,
    };
}
