"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { type VariantProps } from "class-variance-authority";

interface BackButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
    fallbackUrl: string;
    label?: string;
}

export function BackButton({ fallbackUrl, label, variant = "ghost", size = "default", ...props }: BackButtonProps) {
    const router = useRouter();

    const handleBack = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
        } else {
            router.push(fallbackUrl);
        }
    };

    return (
        <Button 
            variant={variant} 
            size={size}
            onClick={handleBack}
            {...props}
            className={props.className || "gap-2 text-slate-500 font-black text-xs uppercase tracking-widest hover:text-primary transition-colors"}
        >
            <ArrowLeft className="w-4 h-4" />
            {label && <span>{label}</span>}
        </Button>
    );
}
