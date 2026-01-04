"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccountingMode } from "@/hooks/use-accounting-mode";
import { Loader2 } from "lucide-react";

export default function IndividualOverviewPage() {
    const router = useRouter();
    const { accountingMode, loading } = useAccountingMode();

    useEffect(() => {
        if (!loading) {
            if (accountingMode === "shared_pool") {
                router.replace("/overview/shared-pool");
            } else {
                router.replace("/expenses/individual");
            }
        }
    }, [accountingMode, loading, router]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading overview...</p>
            </div>
        </div>
    );
}
