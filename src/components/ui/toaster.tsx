"use client";

import { useToast } from "@/hooks/use-toast";
import {
    X,
    CheckCircle2,
    AlertCircle,
    Info,
    AlertTriangle,
} from "lucide-react";

export function Toaster() {
    const { toasts, dismiss } = useToast();

    const getIcon = (type: string) => {
        switch (type) {
            case "success":
                return <CheckCircle2 className="h-5 w-5 text-green-600" />;
            case "error":
                return <AlertCircle className="h-5 w-5 text-red-600" />;
            case "warning":
                return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
            default:
                return <Info className="h-5 w-5 text-blue-600" />;
        }
    };

    const getStyles = (type: string) => {
        switch (type) {
            case "success":
                return "border-green-200 bg-green-50";
            case "error":
                return "border-red-200 bg-red-50";
            case "warning":
                return "border-yellow-200 bg-yellow-50";
            default:
                return "border-blue-200 bg-blue-50";
        }
    };

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-96 max-w-full">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-in slide-in-from-top-5 ${getStyles(
                        toast.type,
                    )}`}
                >
                    {getIcon(toast.type)}
                    <div className="flex-1">
                        {toast.title && (
                            <p className="font-semibold text-sm">
                                {toast.title}
                            </p>
                        )}
                        {toast.description && (
                            <p className="text-sm text-muted-foreground">
                                {toast.description}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => dismiss(toast.id)}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
