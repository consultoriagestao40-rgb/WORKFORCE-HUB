export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, Trash2 } from "lucide-react";
import { NewRoleSheet } from "@/components/admin/NewRoleSheet";
import { deleteRole } from "@/app/actions";

async function getRoles() {
    const roles = await prisma.role.findMany({
        include: {
            _count: {
                select: { employees: true }
            }
        },
        orderBy: { name: 'asc' }
    });
    return roles;
}

export default async function RolesPage() {
    const roles = await getRoles();

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-[0.3em] mb-2">
                        <Briefcase className="fill-current w-3 h-3" /> Gestão de Cargos
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Cargos/Funções</h2>
                    <p className="text-slate-500 font-medium">Gerencie os cargos disponíveis para os colaboradores</p>
                </div>
                <NewRoleSheet />
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-premium">
                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">Diretriz</p>
                        <p className="text-xs font-bold text-slate-400 leading-relaxed max-w-2xl">
                            Os cargos são globais e permitem padronizar funções em toda a organização.
                            Eles serão utilizados no cadastro de colaboradores.
                        </p>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-premium">
                <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle className="text-lg font-black text-slate-800">Lista de Cargos</CardTitle>
                    <CardDescription>Total: {roles.length} cargo(s) cadastrado(s)</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Cargo</th>
                                <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Descrição</th>
                                <th className="text-center p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Colaboradores</th>
                                <th className="text-right p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {roles.map((role) => (
                                <tr key={role.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="w-4 h-4 text-primary" />
                                            <span className="font-black text-slate-900">{role.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-sm text-slate-500">
                                            {role.description || '-'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <Badge variant="outline" className="font-bold">
                                            <Users className="w-3 h-3 mr-1" />
                                            {role._count.employees}
                                        </Badge>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <NewRoleSheet role={role} />
                                            <form action={deleteRole} className="inline">
                                                <input type="hidden" name="id" value={role.id} />
                                                <Button
                                                    type="submit"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                    disabled={role._count.employees > 0}
                                                    title={role._count.employees > 0 ? "Não é possível deletar. Cargo em uso." : "Deletar cargo"}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {roles.length === 0 && (
                        <div className="p-12 text-center">
                            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold">Nenhum cargo cadastrado ainda.</p>
                            <p className="text-xs text-slate-400 mt-1">Clique em "Novo Cargo" para começar.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
