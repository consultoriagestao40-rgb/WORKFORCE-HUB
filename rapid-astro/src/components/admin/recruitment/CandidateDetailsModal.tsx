"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Briefcase, MapPin, Mail, Phone, Calendar, User } from "lucide-react";

interface CandidateDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    candidate: any; // We'll type this better in integration
}

export function CandidateDetailsModal({ open, onOpenChange, candidate }: CandidateDetailsModalProps) {
    if (!candidate) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl">Detalhes do Candidato</DialogTitle>
                    <DialogDescription>
                        Visualizando informações completas do processo seletivo.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    {/* Candidate Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-indigo-600 flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Dados Pessoais
                        </h3>
                        <div className="bg-slate-50 p-4 rounded-lg border space-y-3">
                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase">Nome Completo</label>
                                <div className="text-slate-900 font-medium text-lg">{candidate.name}</div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-center gap-2 text-slate-700">
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    <span>{candidate.email || "Não informado"}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-700">
                                    <Phone className="w-4 h-4 text-slate-400" />
                                    <span>{candidate.phone || "Não informado"}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase">Data de Inscrição</label>
                                <div className="flex items-center gap-2 text-slate-700 mt-1">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <span>{new Date(candidate.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Vacancy Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-orange-600 flex items-center gap-2">
                            <Briefcase className="w-5 h-5" />
                            Dados da Vaga
                        </h3>
                        <div className="bg-orange-50/50 p-4 rounded-lg border border-orange-100 space-y-3">
                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase">Título da Vaga</label>
                                <div className="text-slate-900 font-medium">{candidate.vacancy?.title}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-slate-500 uppercase">Prioridade</label>
                                    <div className="mt-1">
                                        <Badge variant={candidate.vacancy?.priority === 'URGENT' ? 'destructive' : 'secondary'}>
                                            {candidate.vacancy?.priority}
                                        </Badge>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 uppercase">Status</label>
                                    <div className="mt-1 text-sm font-medium">
                                        {candidate.vacancy?.status}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-orange-100/50 space-y-2">
                                <div>
                                    <label className="text-xs font-medium text-slate-500 uppercase">Cliente / Posto</label>
                                    <div className="flex items-center gap-2 text-slate-700 mt-1">
                                        <Building2 className="w-4 h-4 text-slate-400" />
                                        <span>{candidate.vacancy?.posto?.client?.name || "N/A"}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-500 text-sm pl-6">
                                        <span>{candidate.vacancy?.posto?.name}</span>
                                    </div>
                                </div>

                                {candidate.vacancy?.company && (
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 uppercase">Empresa Contratante</label>
                                        <div className="text-slate-700 mt-1">
                                            {candidate.vacancy.company.name}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="py-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">Descrição da Vaga</label>
                    <div className="bg-slate-50 p-3 rounded mt-1 text-sm text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {candidate.vacancy?.description || "Sem descrição"}
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
}
