import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MobileAlertsPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 p-8 text-center space-y-4">
            <div className="bg-slate-200 p-6 rounded-full">
                <ClipboardList className="w-12 h-12 text-slate-500" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-700">Ocorrências</h2>
                <p className="text-sm">Para registrar uma nova ocorrência, selecione o Posto.</p>

                <Link href="/mobile" className="block mt-6">
                    <Button className="w-full bg-slate-900 text-white">
                        Iniciar Nova Ocorrência
                    </Button>
                </Link>
            </div>
        </div>
    );
}
