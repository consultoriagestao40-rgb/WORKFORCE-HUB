"use client";

import { Button } from "@/components/ui/button";
import { moveEmployeeToRotativo } from "@/app/actions";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

export function MoveToRotativoButton({ employeeId }: { employeeId: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleMove = async () => {
        if (!confirm("Tem certeza que deseja mover este colaborador para o Rotativo?")) return;
        setLoading(true);
        try {
            const res = await moveEmployeeToRotativo(employeeId);
            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success("Colaborador movido para o Rotativo com sucesso!");
                router.refresh();
            }
        } catch (e: any) {
            toast.error(e.message || "Erro de conexão.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button 
            variant="outline" 
            onClick={handleMove} 
            disabled={loading}
            className="gap-1.5 border-slate-200 text-slate-800 font-bold h-9 px-3.5 rounded-xl shadow-sm text-[11px] uppercase tracking-wider hover:bg-slate-50 transition-colors bg-white shrink-0"
        >
            <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Alocar no Rotativo</span>
        </Button>
    );
}
