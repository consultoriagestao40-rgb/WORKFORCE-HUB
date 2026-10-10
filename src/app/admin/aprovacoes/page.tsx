export const dynamic = "force-dynamic";

import React from "react";
import { getCurrentUser } from "@/lib/auth";
import { getApprovalRequests, getApprovalMetrics } from "@/actions/approvals";
import { ApprovalsHub } from "@/components/admin/approvals/ApprovalsHub";
import { BackButton } from "@/components/admin/BackButton";
import { CheckSquare } from "lucide-react";
import { redirect } from "next/navigation";

export default async function AprovacoesPage() {
    const user = await getCurrentUser();
    if (!user) {
        redirect("/login");
    }

    const [requests, metrics] = await Promise.all([
        getApprovalRequests(),
        getApprovalMetrics()
    ]);

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen">
            {/* Top Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <BackButton fallbackUrl="/admin" />
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-sm">
                        <CheckSquare className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                            Menu de Aprovações
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Alçada N1 / N2 + Secullum
                            </span>
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Deliberação de postos, escalas, horários, desligamentos e férias com integração direta ao ponto
                        </p>
                    </div>
                </div>
            </div>

            {/* Hub Component */}
            <ApprovalsHub
                initialRequests={requests as any}
                metrics={metrics}
                userRole={user.role}
                userName={user.name}
            />
        </div>
    );
}
