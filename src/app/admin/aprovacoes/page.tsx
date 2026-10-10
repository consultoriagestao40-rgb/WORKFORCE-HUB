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
        <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <BackButton fallbackUrl="/admin" variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-slate-200" />
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
                        <CheckSquare className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-800">Menu de Aprovações</h1>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Alçada N1 / N2 + Secullum
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm">
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
