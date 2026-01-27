"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Building2,
    ArrowLeftRight,
    Receipt,
    DollarSign,
    Settings,
    Wallet,
    LogOut,
    User,
} from "lucide-react";
import { AccountingModeIndicator } from "./AccountingModeIndicator";
import { useAccountingMode } from "@/hooks/use-accounting-mode";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "next-auth/react";

const navItems = [
    {
        href: "/",
        label: "Bank",
        icon: Building2,
    },
    {
        href: "/transactions",
        label: "Transactions",
        icon: ArrowLeftRight,
    },

    {
        href: "/expenses",
        label: "Expenses",
        icon: Receipt,
    },
    {
        href: "/income",
        label: "Income",
        icon: DollarSign,
    },
    {
        href: "/reimbursements",
        label: "Reimbursements",
        icon: Wallet,
    },
];

const rightNavItems = [
    {
        href: "/settings",
        label: "Settings",
        icon: Settings,
    },
];

export function MainNav() {
    const pathname = usePathname();
    const { accountingMode } = useAccountingMode();
    const { data: session } = useSession();

    const isActive = (href: string) => {
        if (href === "/") {
            return pathname === "/";
        }
        return pathname.startsWith(href);
    };

    // Filter nav items based on accounting mode
    const visibleNavItems = navItems.filter((item) => {
        // Hide Reimbursements in individual mode
        if (
            item.href === "/reimbursements" &&
            accountingMode === "individual"
        ) {
            return false;
        }
        return true;
    });

    if (!session?.user || !session.user.mfaVerified) {
        return null;
    }

    return (
        <nav className="border-b bg-background">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1 overflow-x-auto">
                        {visibleNavItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                                        active
                                            ? "border-primary text-foreground"
                                            : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="shrink-0">
                            <AccountingModeIndicator compact />
                        </div>
                        <div className="flex items-center gap-1">
                            {rightNavItems.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                                            active
                                                ? "border-primary text-foreground"
                                                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-2"
                                >
                                    <User className="h-4 w-4" />
                                    <span className="hidden md:inline">
                                        Profile
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>
                                    {session.user.email}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => signOut()}
                                    className="cursor-pointer"
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Sign out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </nav>
    );
}
