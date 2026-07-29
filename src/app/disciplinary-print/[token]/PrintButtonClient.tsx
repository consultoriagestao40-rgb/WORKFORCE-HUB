"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButtonClient() {
    return (
        <Button
            onClick={() => window.print()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 px-4 text-xs gap-1.5 cursor-pointer shadow-md shadow-indigo-500/10"
        >
            <Printer className="w-4 h-4" />
            Imprimir Documento
        </Button>
    );
}
