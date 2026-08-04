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
        cbo?: string | null;
        description: string | null;
        atividadeDescricao?: string | null;
        riscoQuimico?: string | null;
        riscoAcidentes?: string | null;
        episNecessarios?: string | null;
        ordemServicoText?: string | null;
        ordemServicoName?: string | null;
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
            <SheetContent className="px-8 overflow-y-auto sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>{role ? 'Editar Cargo' : 'Novo Cargo/Função'}</SheetTitle>
                    <SheetDescription>
                        {role ? 'Altere os dados do cargo e a Ordem de Serviço associada.' : 'Cadastre um novo cargo e anexe a Ordem de Serviço (Word .docx).'}
                    </SheetDescription>
                </SheetHeader>
                <form action={handleSubmit} className="space-y-4 mt-6">
                    {role && <input type="hidden" name="id" value={role.id} />}
                    
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 space-y-2">
                            <Label htmlFor="name">Nome do Cargo</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Ex: Auxiliar de Serviços Gerais"
                                required
                                defaultValue={role?.name}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cbo">CBO</Label>
                            <Input
                                id="cbo"
                                name="cbo"
                                placeholder="5143-20"
                                defaultValue={role?.cbo || ''}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição (Opcional)</Label>
                        <Textarea
                            id="description"
                            name="description"
                            placeholder="Descrição breve da função..."
                            rows={2}
                            defaultValue={role?.description || ''}
                        />
                    </div>

                    <div className="p-4 rounded-xl border bg-slate-50 space-y-3">
                        <div>
                            <Label className="text-xs font-bold text-slate-800">Ordem de Serviço Padrão do Cargo (NR-1)</Label>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Suba o arquivo Word (.docx) ou preencha a descrição da atividade e riscos específicos deste cargo.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="ordemServicoFile" className="text-xs text-slate-600 font-semibold">
                                {role?.ordemServicoName ? `Anexar Novo Word (.docx) [Atual: ${role.ordemServicoName}]` : "Anexar Arquivo Word (.docx)"}
                            </Label>
                            <Input
                                id="ordemServicoFile"
                                name="ordemServicoFile"
                                type="file"
                                accept=".docx"
                                className="bg-white text-xs"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="atividadeDescricao" className="text-xs text-slate-600 font-semibold">Descrição da Atividade</Label>
                            <Textarea
                                id="atividadeDescricao"
                                name="atividadeDescricao"
                                placeholder="(RELATO DO FUNCIONÁRIO) Realizam a higienização de superfícies variadas..."
                                rows={3}
                                className="bg-white text-xs"
                                defaultValue={role?.atividadeDescricao || ''}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="riscoQuimico" className="text-xs text-slate-600 font-semibold">Riscos Químicos</Label>
                            <Input
                                id="riscoQuimico"
                                name="riscoQuimico"
                                placeholder="Água Sanitária, detergente líquido, etc."
                                className="bg-white text-xs"
                                defaultValue={role?.riscoQuimico || ''}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="riscoAcidentes" className="text-xs text-slate-600 font-semibold">Riscos de Acidentes</Label>
                            <Input
                                id="riscoAcidentes"
                                name="riscoAcidentes"
                                placeholder="Colisão ou batida na condução da máquina, projeção de objetos..."
                                className="bg-white text-xs"
                                defaultValue={role?.riscoAcidentes || ''}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="episNecessarios" className="text-xs text-slate-600 font-semibold">EPIs Necessários e/ou Utilizados</Label>
                            <Input
                                id="episNecessarios"
                                name="episNecessarios"
                                placeholder="Sapato de segurança, Luva de Látex, Óculos de segurança, Uniforme"
                                className="bg-white text-xs"
                                defaultValue={role?.episNecessarios || ''}
                            />
                        </div>
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
