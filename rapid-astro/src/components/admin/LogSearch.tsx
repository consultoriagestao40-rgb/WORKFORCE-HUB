"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce"; // If available? Or manual debounce

export function LogSearch() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [text, setText] = useState(searchParams.get("search") || "");
    // Manual debounce to avoid dependency issues if use-debounce is not installed
    const [debouncedValue, setDebouncedValue] = useState(text);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(text);
        }, 500);
        return () => clearTimeout(timer);
    }, [text]);

    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (debouncedValue) {
            params.set("search", debouncedValue);
        } else {
            params.delete("search");
        }
        router.push(`?${params.toString()}`);
    }, [debouncedValue, router, searchParams]);

    return (
        <div className="relative w-full md:w-[350px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
                type="search"
                placeholder="Buscar por ação, detalhes ou usuário"
                className="pl-9 bg-white"
                value={text}
                onChange={(e) => setText(e.target.value)}
            />
        </div>
    );
}
