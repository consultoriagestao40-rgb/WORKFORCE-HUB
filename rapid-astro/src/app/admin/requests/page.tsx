export const dynamic = "force-dynamic";
import { getAdminRequests } from "./actions";
import { RequestKanban } from "../../../components/admin/requests/RequestKanban";
import { Inbox } from "lucide-react";

export default async function AdminRequestsPage() {
    const requests: any = await getAdminRequests();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-[0.3em] mb-2">
                        Service Desk
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Central de Solicitações (Rapid)</h1>
                    <p className="text-slate-500 font-medium italic">Gerencie demandas e tarefas operacionais</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                        <Inbox className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-bold text-slate-700">{requests.filter((r: any) => r.status === 'PENDENTE').length} Pendentes</span>
                    </div>
                </div>
            </div>

            <RequestKanban requests={requests} />
        </div>
    );
}
