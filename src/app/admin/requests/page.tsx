export const dynamic = "force-dynamic";
import { getAdminRequests } from "./actions";
import { RequestKanban } from "../../../components/admin/requests/RequestKanban";
import { Inbox } from "lucide-react";

export default async function AdminRequestsPage() {
    const requests: any = await getAdminRequests();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-[0.3em] mb-2">
                        Service Desk
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Central de Solicitações</h1>
                    <p className="text-slate-500 font-medium italic">Gerencie demandas e tarefas operacionais</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                        <Inbox className="w-5 h-5 text-orange-500" />
                    </div>
                </div>
            </div>

            <RequestKanban requests={requests} />
        </div>
    );
}
