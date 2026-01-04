import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
    }).format(amount);
}

export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IE", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}
