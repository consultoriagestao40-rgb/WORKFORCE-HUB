"use client";

import { useState } from "react";
import { StickyNote, Calendar, MessageSquare, Trash2 } from "lucide-react";

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
            className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-500 transition cursor-pointer relative group flex flex-col justify-between"
        >
            {/* Header: Foto + Nome + Badge Não Lidas */}
            <div className="flex items-center gap-2.5 mb-1.5">
                <div className="relative flex-shrink-0">
                    {ticket.contactPhotoUrl ? (
                        <img
                            src={ticket.contactPhotoUrl}
                            alt={ticket.contactName}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center">
                            {ticket.contactName?.charAt(0).toUpperCase() || "?"}
                        </div>
                    )}
                    {unreadCount > 0 && (
                        <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                            {unreadCount}
                        </span>
                    )}
                </div>

                <div className="overflow-hidden flex-1">
                    <h4 className="text-xs font-bold text-slate-800 truncate">{ticket.contactName}</h4>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{ticket.contactPhone}</p>
                </div>
            </div>

            {/* Preview da Última Mensagem */}
            <p className="text-[11px] text-slate-500 truncate mb-2">
                {lastMessage ? (
                    <span>{lastMessage.senderType === "ATTENDANT" ? "✓ " : ""}{lastMessage.content}</span>
                ) : (
                    <span className="italic text-slate-400">Atendimento: {ticket.title}</span>
                )}
            </p>

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

            {/* Barra de Ícones Rápidos estilo WaSeller [ 📝 📅 💬 ] */}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-slate-400 text-[10px]">
                <div className="flex items-center gap-3">
                    <button className="hover:text-emerald-600 transition" title="Anotações">
                        <StickyNote className="w-3.5 h-3.5" />
                    </button>
                    <button className="hover:text-emerald-600 transition" title="Agendar Tarefa">
                        <Calendar className="w-3.5 h-3.5" />
                    </button>
                    <button className="hover:text-emerald-600 transition" title="Abrir Chat">
                        <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                </div>
                <span className="text-[9px] font-mono text-slate-400">
                    {new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
}
