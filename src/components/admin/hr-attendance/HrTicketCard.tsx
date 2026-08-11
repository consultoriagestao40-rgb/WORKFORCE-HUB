"use client";

interface Props {
    ticket: any;
    onClick: () => void;
}

export function HrTicketCard({ ticket, onClick }: Props) {
    const lastMessage = ticket.messages?.[0];
    const unreadCount = ticket.unreadCount || 0;

    return (
        <div
            onClick={onClick}
            className="bg-white p-3 rounded-lg border shadow-sm hover:shadow-md hover:border-indigo-400 transition cursor-pointer relative group flex flex-col justify-between"
        >
            {/* Header: Foto + Nome + Badge Não Lidas */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 overflow-hidden">
                    {ticket.contactPhotoUrl ? (
                        <img
                            src={ticket.contactPhotoUrl}
                            alt={ticket.contactName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {ticket.contactName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="overflow-hidden">
                        <h4 className="text-xs font-bold text-slate-800 truncate">{ticket.contactName}</h4>
                        <span className="text-[10px] font-mono text-slate-400 block truncate">{ticket.contactPhone}</span>
                    </div>
                </div>

                {unreadCount > 0 && (
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                        {unreadCount}
                    </span>
                )}
            </div>

            {/* Nome da Solicitação */}
            <div className="bg-slate-50 p-1.5 rounded border border-slate-100 mb-2">
                <p className="text-[11px] font-semibold text-slate-700 truncate">{ticket.title}</p>
            </div>

            {/* Última Mensagem */}
            {lastMessage && (
                <p className="text-[10px] text-slate-500 truncate mb-2 italic">
                    {lastMessage.senderType === "ATTENDANT" ? "Você: " : ""}{lastMessage.content}
                </p>
            )}

            {/* Etiquetas */}
            {ticket.labels?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {ticket.labels.map((lbl: any) => (
                        <span
                            key={lbl.id}
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded text-white"
                            style={{ backgroundColor: lbl.color }}
                        >
                            {lbl.name}
                        </span>
                    ))}
                </div>
            )}

            {/* Footer: Atendente + Timestamp */}
            <div className="flex items-center justify-between pt-1 border-t text-[9px] text-slate-400">
                <span>
                    {ticket.assignee ? `👤 ${ticket.assignee.name}` : "👥 Livre"}
                </span>
                <span>
                    {new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
}
