"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { createRole, updateRole } from "@/app/actions";

interface RoleSheetProps {
    role?: {
        id: string;
        name: string;
        description: string | null;
    };
}

export function NewRoleSheet({ role }: RoleSheetProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        try {
            if (role) {
                await updateRole(formData);
            } else {
                await createRole(formData);
            }
            setOpen(false);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {role ? (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                        <Pencil className="w-4 h-4" />
                    </Button>
                ) : (
                    <Button><Plus className="w-4 h-4 mr-2" /> Novo Cargo</Button>
                )}
            </SheetTrigger>
            <SheetContent className="px-8">
                <SheetHeader>
                    <SheetTitle>{role ? 'Editar Cargo' : 'Novo Cargo/Função'}</SheetTitle>
                    <SheetDescription>
                        {role ? 'Altere os dados do cargo existente.' : 'Cadastre um novo cargo para ser usado nos colaboradores.'}
                    </SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6">
                    {role && <input type="hidden" name="id" value={role.id} />}
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome do Cargo</Label>
                        <Input
                            id="name"
                            name="name"
                            placeholder="Ex: Porteiro Diurno"
                            required
                            defaultValue={role?.name}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição (Opcional)</Label>
                        <Textarea
                            id="description"
                            name="description"
                            placeholder="Descrição breve do cargo..."
                            rows={3}
                            defaultValue={role?.description || ''}
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {role ? 'Salvar Alterações' : 'Salvar Cargo'}
                    </Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
