import { useState, useEffect } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
    id: string;
    title?: string;
    description?: string;
    type: ToastType;
}

interface ToasterToast extends Toast {
    id: string;
}

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 5000;

let count = 0;

function genId() {
    count = (count + 1) % Number.MAX_VALUE;
    return count.toString();
}

type ToasterState = {
    toasts: ToasterToast[];
};

const listeners: Array<(state: ToasterState) => void> = [];
let memoryState: ToasterState = { toasts: [] };

function dispatch(action: { type: string; toast?: ToasterToast }) {
    if (action.type === "ADD_TOAST") {
        const toast = action.toast!;
        memoryState = {
            toasts: [toast, ...memoryState.toasts].slice(0, TOAST_LIMIT),
        };
    }

    if (action.type === "REMOVE_TOAST") {
        memoryState = {
            toasts: memoryState.toasts.filter((t) => t.id !== action.toast!.id),
        };
    }

    listeners.forEach((listener) => {
        listener(memoryState);
    });
}

export function toast({
    title,
    description,
    type = "info",
}: {
    title?: string;
    description?: string;
    type?: ToastType;
}) {
    const id = genId();

    const newToast: ToasterToast = {
        id,
        title,
        description,
        type,
    };

    dispatch({
        type: "ADD_TOAST",
        toast: newToast,
    });

    setTimeout(() => {
        dispatch({
            type: "REMOVE_TOAST",
            toast: newToast,
        });
    }, TOAST_REMOVE_DELAY);

    return {
        id: id,
        dismiss: () => {
            dispatch({
                type: "REMOVE_TOAST",
                toast: newToast,
            });
        },
    };
}

export function useToast() {
    const [state, setState] = useState<ToasterState>(memoryState);

    useEffect(() => {
        listeners.push(setState);
        return () => {
            const index = listeners.indexOf(setState);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }, [setState]);

    return {
        ...state,
        toast,
    };
}
