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
            className="w-full border-slate-200 text-slate-900 rounded-2xl h-14 font-black justify-between group hover:bg-slate-50 transition-colors"
        >
            <span>Alocar no Rotativo</span>
            <RotateCw className={`w-4 h-4 text-slate-500 group-hover:rotate-180 transition-transform duration-500 ${loading ? 'animate-spin' : ''}`} />
        </Button>
    );
}
