"use client";

import { useState, useEffect } from "react";
import { getHrTickets } from "@/actions/hr-attendance";

interface Props {
    onSelectTicket: (ticketId: string) => void;
}

export function HrHistoryView({ onSelectTicket }: Props) {
    const [closedTickets, setClosedTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const res = await getHrTickets({ status: "CLOSED" });
            setClosedTickets(res);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, []);

    return (
        <div className="flex-1 p-6 bg-slate-100/70 overflow-y-auto">
            <div className="bg-white rounded-xl border shadow-sm p-4">
                <h3 className="font-bold text-sm text-slate-800 mb-4 flex items-center gap-2">
                    <span>📜</span> Histórico de Atendimentos Encerrados ({closedTickets.length})
                </h3>

                {loading ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Carregando histórico...</p>
                ) : closedTickets.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Nenhum atendimento encerrado até o momento.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b text-[10px]">
                                <tr>
                                    <th className="p-3">Contato</th>
                                    <th className="p-3">Solicitação / Assunto</th>
                                    <th className="p-3">Atendente</th>
                                    <th className="p-3">Data de Encerramento</th>
                                    <th className="p-3 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {closedTickets.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-semibold text-slate-800">
                                            {t.contactName}
                                            <span className="block text-[10px] font-mono text-slate-400">{t.contactPhone}</span>
                                        </td>
                                        <td className="p-3 text-slate-700">{t.title}</td>
                                        <td className="p-3 text-slate-600 font-medium">
                                            {t.assignee ? `👤 ${t.assignee.name}` : "Não atribuído"}
                                        </td>
                                        <td className="p-3 text-slate-500 font-mono">
                                            {t.closedAt ? new Date(t.closedAt).toLocaleString() : "—"}
                                        </td>
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={() => onSelectTicket(t.id)}
                                                className="text-xs text-indigo-600 font-semibold hover:underline"
                                            >
                                                Ver Conversa ➔
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
