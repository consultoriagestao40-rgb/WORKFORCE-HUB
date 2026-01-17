export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Users, Trash2, Percent } from "lucide-react";
import { NewAllowanceTypeSheet } from "@/components/admin/NewAllowanceTypeSheet";
import { deleteAllowanceType } from "@/app/actions";

async function getAllowanceTypes() {
    const types = await prisma.allowanceType.findMany({
        include: {
            _count: {
                select: { employeeAllowances: true }
            }
        },
        orderBy: { name: 'asc' }
    });
    return types;
}

export default async function AllowanceTypesPage() {
    const types = await getAllowanceTypes();

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-[0.3em] mb-2">
                        <DollarSign className="fill-current w-3 h-3" /> Gestão de Adicionais
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Tipos de Adicionais</h2>
                    <p className="text-slate-500 font-medium">Gerencie os tipos de adicionais de folha disponíveis</p>
                </div>
                <NewAllowanceTypeSheet />
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-premium">
                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">Diretriz</p>
                        <p className="text-xs font-bold text-slate-400 leading-relaxed max-w-2xl">
                            Os tipos de adicionais são globais e permitem criar adicionais customizados como Assiduidade, Sobreaviso, Cargo de Confiança, etc.
                            Cada tipo pode ser valor fixo (R$) ou percentual (%) sobre o salário.
                        </p>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-premium">
                <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle className="text-lg font-black text-slate-800">Lista de Tipos</CardTitle>
                    <CardDescription>Total: {types.length} tipo(s) cadastrado(s)</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Nome</th>
                                <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipo</th>
                                <th className="text-left p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Descrição</th>
                                <th className="text-center p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Usos</th>
                                <th className="text-right p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {types.map((type) => (
                                <tr key={type.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <DollarSign className="w-4 h-4 text-primary" />
                                            <span className="font-black text-slate-900">{type.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <Badge variant="outline" className={type.isPercentage ? "border-primary/20 bg-primary/5 text-primary" : "border-emerald-500/20 bg-emerald-50 text-emerald-700"}>
                                            {type.isPercentage ? <><Percent className="w-3 h-3 mr-1" /> Percentual</> : <>R$ Fixo</>}
                                        </Badge>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-sm text-slate-500">{type.description || '-'}</span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <Badge variant="outline" className="font-bold">
                                            <Users className="w-3 h-3 mr-1" />
                                            {type._count.employeeAllowances}
                                        </Badge>
                                    </td>
                                    <td className="p-4 text-right">
                                        <form action={deleteAllowanceType} className="inline">
                                            <input type="hidden" name="id" value={type.id} />
                                            <Button
                                                type="submit"
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                disabled={type._count.employeeAllowances > 0}
                                                title={type._count.employeeAllowances > 0 ? "Não é possível deletar. Tipo em uso." : "Deletar tipo"}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </form>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {types.length === 0 && (
                        <div className="p-12 text-center">
                            <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold">Nenhum tipo de adicional cadastrado ainda.</p>
                            <p className="text-xs text-slate-400 mt-1">Clique em "Novo Tipo de Adicional" para começar.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
