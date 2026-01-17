"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createVacancy } from "@/actions/recruitment";

interface VacancyModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roles: { id: string, name: string }[];
    postos: { id: string, name: string }[];
    companies: { id: string, name: string }[];
    backlogs: any[];
    recruiters: { id: string, name: string }[];
}

export function VacancyModal({ open, onOpenChange, roles, postos, companies, backlogs, recruiters }: VacancyModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [useBacklog, setUseBacklog] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        roleId: "none",
        postoId: "none",
        companyId: "none",
        priority: "MEDIUM",
        recruiterId: ""
    });

    const toTitleCase = (str: string) => {
        return str.toLowerCase().split(' ').map(word => {
            if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(word)) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
    };

    const handleBacklogSelect = (backlogId: string) => {
        const item = backlogs.find(b => b.id === backlogId);
        if (item) {
            const formattedClient = toTitleCase(item.clientName);
            setFormData({
                ...formData,
                title: `${item.roleName} - ${formattedClient}`,
                roleId: item.roleId,
                postoId: item.postoId,
                companyId: item.companyId || "none",
                description: `Vaga de Reposição\n\nCliente: ${formattedClient}\nCargo: ${item.roleName}\nPosto: ${toTitleCase(item.title)}`
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.recruiterId) {
            toast.error("Selecione um recrutador responsável.");
            return;
        }

        setIsLoading(true);

        try {
            await createVacancy({
                title: formData.title,
                description: formData.description,
                roleId: formData.roleId === "none" ? undefined : formData.roleId,
                postoId: formData.postoId === "none" ? undefined : formData.postoId,
                companyId: formData.companyId === "none" ? undefined : formData.companyId,
                priority: formData.priority,
                recruiterId: formData.recruiterId
            });
            toast.success("Vaga criada com sucesso!");
            onOpenChange(false);
            setFormData({
                title: "",
                description: "",
                roleId: "none",
                postoId: "none",
                companyId: "none",
                priority: "MEDIUM",
                recruiterId: ""
            });
            setUseBacklog(false);
        } catch (error) {
            toast.error("Erro ao criar vaga");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px]">
                <DialogHeader>
                    <DialogTitle>Nova Vaga</DialogTitle>
                    <DialogDescription>
                        Abra uma nova vaga para recrutamento.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center space-x-2 py-2 bg-slate-50 p-2 rounded border">
                    <input
                        type="checkbox"
                        id="useBacklog"
                        checked={useBacklog}
                        onChange={(e) => setUseBacklog(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <Label htmlFor="useBacklog" className="cursor-pointer font-medium">Selecionar do Backlog (Vagas em Aberto)</Label>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    {useBacklog && (
                        <div className="grid gap-2">
                            <Label htmlFor="backlog" className="text-orange-600 font-bold">Posto Vago (Backlog)</Label>
                            <Select onValueChange={handleBacklogSelect}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione o posto vago..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {backlogs.map(item => (
                                        <SelectItem key={item.id} value={item.id} className="max-w-[750px] truncate">
                                            {item.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="title">Título da Vaga</Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Ex: Vigilante Noturno"
                            required
                            disabled={useBacklog}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="recruiter" className="text-red-700 font-bold">Recrutador Responsável *</Label>
                        <Select
                            value={formData.recruiterId}
                            onValueChange={(val) => setFormData({ ...formData, recruiterId: val })}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o recrutador..." />
                            </SelectTrigger>
                            <SelectContent>
                                {recruiters.map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Requisitos e detalhes da vaga..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="role">Cargo</Label>
                            <Select
                                value={formData.roleId}
                                onValueChange={(val) => setFormData({ ...formData, roleId: val })}
                                disabled={useBacklog}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Selecione...</SelectItem>
                                    {roles.map(role => (
                                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="priority">Prioridade</Label>
                            <Select
                                value={formData.priority}
                                onValueChange={(val) => setFormData({ ...formData, priority: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOW">Baixa</SelectItem>
                                    <SelectItem value="MEDIUM">Média</SelectItem>
                                    <SelectItem value="HIGH">Alta</SelectItem>
                                    <SelectItem value="URGENT">Urgente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="company">Empresa (Opcional)</Label>
                        <Select
                            value={formData.companyId}
                            onValueChange={(val) => setFormData({ ...formData, companyId: val })}
                            disabled={useBacklog}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione empresa..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nenhuma</SelectItem>
                                {companies.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="posto">Posto (Opcional)</Label>
                        <Select
                            value={formData.postoId}
                            onValueChange={(val) => setFormData({ ...formData, postoId: val })}
                            disabled={useBacklog}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Associe a um posto..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                {postos.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isLoading}>Criar Vaga</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
