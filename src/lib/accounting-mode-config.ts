/**
 * Accounting Mode Configuration
 *
 * This module centralizes all mode-specific behavior for Individual and Shared Pool accounting modes.
 * It eliminates the need for if-else statements throughout the codebase by providing
 * mode-specific configurations and factory functions.
 */

export type AccountingMode = "individual" | "shared_pool";

export interface ModeConfig {
    mode: AccountingMode;
    displayName: string;
    description: string;

    // API endpoints
    endpoints: {
        expenses: string;
        income: string;
    };

    // Feature flags
    features: {
        expenseSplits: boolean;
        personalAllowances: boolean;
        poolBalance: boolean;
        reimbursements: boolean;
        budgets: boolean;
        userRatios: boolean;
    };

    // UI Configuration
    ui: {
        showSplitTypeSelector: boolean;
        showPaidFromPoolCheckbox: boolean;
        showBalanceCards: boolean;
        showPoolSummary: boolean;
        showReimbursementButton: boolean;
        expenseListComponent: "individual" | "shared-pool";
    };

    // Expense form fields
    expenseForm: {
        requiredFields: string[];
        optionalFields: string[];
        splitTypes?: Array<"equal" | "ratio" | "custom">;
    };
}

export const INDIVIDUAL_MODE_CONFIG: ModeConfig = {
    mode: "individual",
    displayName: "Individual Accounts",
    description: "Track expenses with individual account splits",

    endpoints: {
        expenses: "/api/expenses/individual",
        income: "/api/income",
    },

    features: {
        expenseSplits: true,
        personalAllowances: false,
        poolBalance: false,
        reimbursements: false,
        budgets: false,
        userRatios: true,
    },

    ui: {
        showSplitTypeSelector: true,
        showPaidFromPoolCheckbox: false,
        showBalanceCards: true,
        showPoolSummary: false,
        showReimbursementButton: false,
        expenseListComponent: "individual",
    },

    expenseForm: {
        requiredFields: [
            "date",
            "description",
            "categoryId",
            "amount",
            "paidById",
            "type",
        ],
        optionalFields: ["splitType", "customSplits"],
        splitTypes: ["equal", "ratio", "custom"],
    },
};

export const SHARED_POOL_MODE_CONFIG: ModeConfig = {
    mode: "shared_pool",
    displayName: "Shared Pool",
    description: "Manage expenses from a shared pool with personal allowances",

    endpoints: {
        expenses: "/api/expenses/shared-pool",
        income: "/api/income/shared-pool",
    },

    features: {
        expenseSplits: false,
        personalAllowances: true,
        poolBalance: true,
        reimbursements: true,
        budgets: false,
        userRatios: false,
    },

    ui: {
        showSplitTypeSelector: false,
        showPaidFromPoolCheckbox: true,
        showBalanceCards: false,
        showPoolSummary: true,
        showReimbursementButton: true,
        expenseListComponent: "shared-pool",
    },

    expenseForm: {
        requiredFields: [
            "date",
            "description",
            "categoryId",
            "amount",
            "paidById",
            "type",
        ],
        optionalFields: ["paidFromPool"],
    },
};

/**
 * Get the configuration for a specific accounting mode
 */
export function getModeConfig(mode: AccountingMode): ModeConfig {
    return mode === "individual"
        ? INDIVIDUAL_MODE_CONFIG
        : SHARED_POOL_MODE_CONFIG;
}

/**
 * Type guard to check if a feature is enabled for the current mode
 */
export function isFeatureEnabled(
    mode: AccountingMode,
    feature: keyof ModeConfig["features"],
): boolean {
    const config = getModeConfig(mode);
    return config.features[feature];
}

/**
 * Get the appropriate endpoint for a resource type
 */
export function getEndpoint(
    mode: AccountingMode,
    resource: "expenses" | "income",
): string {
    const config = getModeConfig(mode);
    return config.endpoints[resource];
}

/**
 * Check if a UI element should be shown
 */
export function shouldShowUIElement(
    mode: AccountingMode,
    element: keyof ModeConfig["ui"],
): boolean {
    const config = getModeConfig(mode);
    return config.ui[element] as boolean;
}

/**
 * Validation helper for expense forms
 */
export function validateExpenseData(
    mode: AccountingMode,
    data: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
    const config = getModeConfig(mode);
    const errors: string[] = [];

    // Check required fields
    config.expenseForm.requiredFields.forEach((field) => {
        if (!data[field]) {
            errors.push(`${field} is required`);
        }
    });

    // Mode-specific validations
    if (mode === "individual") {
        if (data.type === "shared" && data.splitType === "custom") {
            if (
                !data.customSplits ||
                (Array.isArray(data.customSplits) &&
                    data.customSplits.length === 0)
            ) {
                errors.push(
                    "Custom splits are required when split type is custom",
                );
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Helper to get route paths based on mode
 */
export function getModeRoutePath(
    mode: AccountingMode,
    basePath: "expenses" | "overview",
): string {
    return `/${basePath}/${mode === "individual" ? "individual" : "shared-pool"}`;
}
