import { getAuthHeaders } from "./jwt";
import { readFileSync } from "fs";
import { join } from "path";

const ENABLE_BANKING_API_BASE =
    process.env.ENABLE_BANKING_API_BASE || "https://api.enablebanking.com";

export interface EnableBankingConfig {
    privateKey: string;
    appId: string;
}

export interface AuthStartRequest {
    access: {
        valid_until: string;
    };
    aspsp: {
        name: string;
        country: string;
    };
    state: string;
    redirect_url: string;
    psu_type?: "personal" | "business";
}

export interface AuthStartResponse {
    url: string;
    session_id: string;
}

export interface SessionCreateRequest {
    code: string;
    session_id: string;
}

export interface SessionCreateResponse {
    session_id: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    accounts?: Account[];
    aspsp?: {
        name: string;
        country: string;
    };
    psu_type?: string;
    access?: {
        accounts: unknown;
        balances: boolean;
        transactions: boolean;
        valid_until: string;
    };
}

export interface Account {
    account_id: {
        iban?: string;
        other?: string;
    };
    uid?: string;
    currency: string;
    name?: string;
    product?: string;
    cash_account_type?: string;
    usage?: string;
    balance?: {
        amount: number;
        currency: string;
    };
    available_balance?: {
        amount: number;
        currency: string;
    };
}

export interface Transaction {
    entry_reference: string;
    transaction_id?: string;
    booking_date?: string;
    value_date?: string;
    transaction_amount: {
        amount: string;
        currency: string;
    };
    creditor?: {
        name?: string;
    };
    debtor?: {
        name?: string;
    };
    remittance_information?: string[];
    status?: string;
    merchant_category_code?: string;
    credit_debit_indicator?: string;
}

export interface TransactionsResponse {
    transactions: Transaction[];
    continuation_key?: string;
}

export interface ASPSP {
    name: string;
    country: string;
    psu_type: string[];
    services: string[];
    payment_types?: string[];
}

export class EnableBankingClient {
    private config: EnableBankingConfig;

    constructor(config: EnableBankingConfig) {
        this.config = config;
    }

    private getHeaders(): Record<string, string> {
        return getAuthHeaders(this.config.privateKey, this.config.appId);
    }

    async startAuth(request: AuthStartRequest): Promise<AuthStartResponse> {
        const response = await fetch(`${ENABLE_BANKING_API_BASE}/auth`, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Enable Banking auth start failed: ${error}`);
        }

        return response.json();
    }

    async createSession(
        request: SessionCreateRequest,
    ): Promise<SessionCreateResponse> {
        const response = await fetch(`${ENABLE_BANKING_API_BASE}/sessions`, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Enable Banking session creation failed: ${error}`);
        }

        return response.json();
    }

    async getAccounts(accessToken: string): Promise<Account[]> {
        const response = await fetch(`${ENABLE_BANKING_API_BASE}/accounts`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Enable Banking get accounts failed: ${error}`);
        }

        const data = await response.json();
        return data.accounts || [];
    }

    async getTransactions(
        accessToken: string,
        accountId: string,
        dateFrom?: string,
        dateTo?: string,
        continuationKey?: string,
    ): Promise<TransactionsResponse> {
        const params = new URLSearchParams();
        if (dateFrom) params.append("date_from", dateFrom);
        if (dateTo) params.append("date_to", dateTo);
        if (continuationKey) params.append("continuation_key", continuationKey);

        const url = `${ENABLE_BANKING_API_BASE}/accounts/${accountId}/transactions${params.toString() ? `?${params.toString()}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Enable Banking get transactions failed: ${error}`);
        }

        return response.json();
    }

    async getTransactionsBySession(
        sessionId: string,
        accountUid: string,
        dateFrom?: string,
        dateTo?: string,
        continuationKey?: string,
    ): Promise<TransactionsResponse> {
        const params = new URLSearchParams();
        if (dateFrom) params.append("date_from", dateFrom);
        if (dateTo) params.append("date_to", dateTo);
        if (continuationKey) params.append("continuation_key", continuationKey);

        // Correct Enable Banking API endpoint: GET /accounts/{account_id}/transactions
        const url = `${ENABLE_BANKING_API_BASE}/accounts/${accountUid}/transactions${params.toString() ? `?${params.toString()}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Enable Banking get transactions failed: ${error}`);
        }

        return response.json();
    }

    async getAccountDetails(sessionId: string, accountUid: string) {
        // According to Enable Banking API: GET /accounts/{account_id}/balances
        const url = `${ENABLE_BANKING_API_BASE}/accounts/${accountUid}/balances`;

        const response = await fetch(url, {
            method: "GET",
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(
                `Enable Banking get account balances failed: ${error}`,
            );
        }

        return response.json();
    }

    async refreshSession(refreshToken: string): Promise<SessionCreateResponse> {
        const response = await fetch(
            `${ENABLE_BANKING_API_BASE}/sessions/refresh`,
            {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ refresh_token: refreshToken }),
            },
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Enable Banking session refresh failed: ${error}`);
        }

        return response.json();
    }

    async getASPSPs(country?: string, psuType?: string): Promise<ASPSP[]> {
        const params = new URLSearchParams();
        if (country) params.append("country", country);
        if (psuType) params.append("psu_type", psuType);

        const url = `${ENABLE_BANKING_API_BASE}/aspsps${params.toString() ? `?${params.toString()}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Enable Banking get ASPSPs failed: ${error}`);
        }

        const data = await response.json();
        return data.aspsps || [];
    }
}

export function createEnableBankingClient(): EnableBankingClient {
    const privateKeyPath = process.env.ENABLE_BANKING_PRIVATE_KEY_PATH;
    const privateKeyContent = process.env.ENABLE_BANKING_PRIVATE_KEY;
    const appId = process.env.ENABLE_BANKING_APP_ID;

    if (!appId) {
        throw new Error("ENABLE_BANKING_APP_ID must be set");
    }

    let privateKey: string;

    if (privateKeyPath) {
        // Read from file path
        const fullPath = privateKeyPath.startsWith("/")
            ? privateKeyPath
            : join(process.cwd(), privateKeyPath);
        privateKey = readFileSync(fullPath, "utf-8");
    } else if (privateKeyContent) {
        // Use direct content
        privateKey = privateKeyContent;
    } else {
        throw new Error(
            "Either ENABLE_BANKING_PRIVATE_KEY_PATH or ENABLE_BANKING_PRIVATE_KEY must be set",
        );
    }

    return new EnableBankingClient({
        privateKey,
        appId,
    });
}
