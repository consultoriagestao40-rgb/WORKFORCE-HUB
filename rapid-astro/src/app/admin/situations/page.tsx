import { prisma } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Trash2, Settings2, Info } from "lucide-react";
import { NewSituationSheet } from "@/components/admin/NewSituationSheet";
import { deleteSituation } from "@/app/actions";

async function getSituations() {
    return await prisma.situation.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { employees: true } } }
    });
}

export default async function SituationsPage() {
    const situations = await getSituations();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-[0.3em] mb-2">
                        Workforce Intelligence
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Status & Situações</h1>
                    <p className="text-slate-500 font-medium italic">Customização de estados operacionais e administrativos</p>
                </div>
                <div className="flex items-center gap-3">
                    <NewSituationSheet />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <Card className="border-none shadow-premium overflow-hidden bg-white/50 backdrop-blur-md">
                    <CardHeader className="bg-white border-b border-slate-100 p-8">
                        <div>
                            <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <Settings2 className="w-5 h-5 text-primary" /> Configuração Global
                            </CardTitle>
                            <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-slate-400">
                                Mapeamento de jornadas e estados contratuais
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 hover:bg-transparent">
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest pl-8 py-4 w-[100px]">Visual</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Identificação</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Capacidade / Impacto</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-8">Gestão</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {situations.map((sit) => (
                                    <TableRow key={sit.id} className="group hover:bg-slate-50 transition-colors">
                                        <TableCell className="pl-8 py-5">
                                            <div
                                                className="w-8 h-8 rounded-xl border-2 border-white shadow-premium transition-transform group-hover:scale-110"
                                                style={{ backgroundColor: sit.color }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Badge style={{ backgroundColor: sit.color }} className="text-white border-none font-black text-[10px] uppercase tracking-wider px-3 py-1">
                                                {sit.name}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm font-bold text-slate-600">
                                                {sit._count.employees} {sit._count.employees === 1 ? 'colaborador vinculado' : 'colaboradores vinculados'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            <div className="flex items-center justify-end gap-2">
                                                <NewSituationSheet situation={sit} />
                                                <form action={deleteSituation}>
                                                    <input type="hidden" name="id" value={sit.id} />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-10 w-10 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-20"
                                                        disabled={sit._count.employees > 0}
                                                        title={sit._count.employees > 0 ? "Não é possível excluir situações em uso" : "Excluir Registro"}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </form>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {situations.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-20">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                                                    <Info className="w-6 h-6" />
                                                </div>
                                                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhuma situação cadastrada</p>
                                                <p className="text-xs text-slate-400 font-medium">Comece adicionando situações como "Ativo" ou "Férias".</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="p-6 rounded-[2rem] bg-slate-900 text-white flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                        <Info className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">Diretriz de Design</p>
                        <p className="text-xs font-bold text-slate-400 leading-relaxed max-w-2xl">
                            As situações são globais e permitem que o RH gerencie estados como Férias, Afastamentos, e Desligamentos de forma personalizada.
                            Cores vibrantes ajudam na identificação rápida na Central de Comando.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
