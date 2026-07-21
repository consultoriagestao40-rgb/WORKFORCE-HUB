"use client";

import { useEffect } from "react";
import { Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintFichaClient() {
    useEffect(() => {
        // Trigger print after page elements and styles are loaded
        const timer = setTimeout(() => {
            window.print();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 text-orange-400 rounded-xl shrink-0">
                    <FileText className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-200">
                    <strong className="text-white block font-bold text-[13px] mb-0.5">Instruções para salvar em PDF:</strong>
                    Na janela de impressão que se abriu, altere o campo <strong className="text-orange-400 font-extrabold">"Destino"</strong> (ou "Salvar como") para <strong className="text-orange-400 font-extrabold">"Salvar como PDF"</strong> e clique em Salvar.
                </div>
            </div>
            <Button 
                onClick={() => window.print()}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs h-9 px-4 gap-1.5 shrink-0"
            >
                <Printer className="w-4 h-4" /> Reabrir Impressora
            </Button>
        </div>
    );
}
