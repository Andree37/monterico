import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            mfaSetupComplete: boolean;
            mfaRequired: boolean;
            mfaVerified: boolean;
            bankOperationMfaVerifiedAt: number | null;
        };
    }

    interface User {
        id: string;
        email: string;
        name?: string | null;
        mfaSetupComplete: boolean;
        mfaRequired: boolean;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string;
        mfaSetupComplete?: boolean;
        mfaRequired?: boolean;
        mfaVerified?: boolean;
        bankOperationMfaVerifiedAt?: number | null;
    }
}
