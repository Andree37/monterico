"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReactNode } from "react";
import {
    Building2,
    Receipt,
    BarChart3,
    Wallet,
    ArrowLeftRight,
    Settings,
    Users,
    DollarSign,
} from "lucide-react";

export interface TabDefinition {
    value: string;
    label: string;
    content: ReactNode;
    icon?: ReactNode;
}

interface TabsContainerProps {
    tabs: TabDefinition[];
    defaultValue?: string;
    value?: string;
    className?: string;
    onTabChange?: (value: string) => void;
}

export function TabsContainer({
    tabs,
    defaultValue,
    value,
    className = "mt-6 space-y-6",
    onTabChange,
}: TabsContainerProps) {
    return (
        <Tabs
            value={value}
            defaultValue={defaultValue || tabs[0]?.value}
            className={className}
            onValueChange={onTabChange}
        >
            <TabsList>
                {tabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                        {tab.icon && <span className="mr-2">{tab.icon}</span>}
                        {tab.label}
                    </TabsTrigger>
                ))}
            </TabsList>

            {tabs.map((tab) => (
                <TabsContent
                    key={tab.value}
                    value={tab.value}
                    className="space-y-6"
                >
                    {tab.content}
                </TabsContent>
            ))}
        </Tabs>
    );
}

export const TabIcons = {
    BankConnections: Building2,
    Transactions: ArrowLeftRight,
    Overview: BarChart3,
    Expenses: Receipt,
    Income: DollarSign,
    Wallet: Wallet,
    Users: Users,
    Settings: Settings,
};
