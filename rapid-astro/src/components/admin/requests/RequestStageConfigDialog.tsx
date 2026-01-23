"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getStageConfiguration, updateStageConfiguration, getRecruiters } from "@/app/admin/requests/actions";
import { Loader2 } from "lucide-react";

interface RequestStageConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    columnTitle: string;
    targetStatus: string;
}

export function RequestStageConfigDialog({ open, onOpenChange, columnTitle, targetStatus }: RequestStageConfigDialogProps) {
    const [slaDays, setSlaDays] = useState(3);
    const [approverId, setApproverId] = useState<string>("none");
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            loadData();
        }
    }, [open, targetStatus]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [config, recruiters] = await Promise.all([
                getStageConfiguration(targetStatus),
                getRecruiters()
            ]);

            setUsers(recruiters);
            if (config) {
                setSlaDays(config.slaDays);
                setApproverId(config.approverId || "none");
            } else {
                setSlaDays(3);
                setApproverId("none");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar configurações");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateStageConfiguration(targetStatus, {
                slaDays: Number(slaDays),
                approverId: approverId === "none" ? undefined : approverId
            });
            toast.success("Configuração salva com sucesso!");
            onOpenChange(false);
        } catch (error) {
            toast.error("Erro ao salvar configuração.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Configurar Etapa: {columnTitle}</DialogTitle>
                    <DialogDescription>
                        Defina o SLA e o aprovador padrão para solicitações nesta etapa.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-8 flex justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>SLA (Dias)</Label>
                            <Input
                                type="number"
                                min={0}
                                value={slaDays}
                                onChange={(e) => setSlaDays(Number(e.target.value))}
                            />
                            <p className="text-xs text-slate-500">
                                Tempo ideal para permanência nesta etapa.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Aprovador Responsável</Label>
                            <Select value={approverId} onValueChange={setApproverId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sem aprovador específico</SelectItem>
                                    {users.map(u => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.name} ({u.role})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">
                                Usuário que deve aprovar solicitações nesta fase (se aplicável).
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={loading || saving}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Salvar Configuração
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
