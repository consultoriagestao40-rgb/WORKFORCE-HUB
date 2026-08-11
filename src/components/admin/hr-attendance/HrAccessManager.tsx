"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getHrAccessPermissions, toggleHrAccessPermission } from "@/actions/hr-attendance";

interface Props {
    open: boolean;
    onClose: () => void;
}

export function HrAccessManager({ open, onClose }: Props) {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await getHrAccessPermissions();
            if (res.users) setUsers(res.users);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) loadUsers();
    }, [open]);

    const handleToggle = async (userId: string) => {
        setUsers(prev => prev.map(u => {
            if (u.id === userId) {
                const hasPerm = !!u.hrAccessPermission;
                return { ...u, hrAccessPermission: hasPerm ? null : { id: "temp" } };
            }
            return u;
        }));
        await toggleHrAccessPermission(userId);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span>🔒</span> Controle de Acesso — Atendimento RH
                    </DialogTitle>
                </DialogHeader>

                <p className="text-xs text-slate-500">
                    Defina quais usuários do sistema podem visualizar e utilizar a Central de Atendimento RH. Usuários ADMIN possuem acesso automático.
                </p>

                <div className="space-y-2 py-2 max-h-[350px] overflow-y-auto">
                    {loading ? (
                        <div className="text-xs text-center py-6 text-slate-400">Carregando usuários...</div>
                    ) : (
                        users.map(u => {
                            const isAdmin = u.role === "ADMIN";
                            const hasAccess = isAdmin || !!u.hrAccessPermission;

                            return (
                                <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-slate-50">
                                    <div>
                                        <div className="text-xs font-semibold text-slate-800">{u.name}</div>
                                        <div className="text-[10px] text-slate-400">@{u.username} • {u.role}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isAdmin ? (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                Acesso Total (ADMIN)
                                            </span>
                                        ) : (
                                            <Switch
                                                checked={hasAccess}
                                                onCheckedChange={() => handleToggle(u.id)}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="flex justify-end pt-2 border-t">
                    <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
