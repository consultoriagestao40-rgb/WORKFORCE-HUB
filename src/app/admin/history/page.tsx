export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, User, Bot, UserCheck, Shield } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogSearch } from "@/components/admin/LogSearch";

async function getLogs(search?: string) {
    const where: any = {};

    if (search) {
        where.OR = [
            { action: { contains: search, mode: 'insensitive' } },
            { details: { contains: search, mode: 'insensitive' } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { user: { username: { contains: search, mode: 'insensitive' } } },
            { employee: { name: { contains: search, mode: 'insensitive' } } },
            { employee: { cpf: { contains: search, mode: 'insensitive' } } }
        ];
    }

    return await prisma.log.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: 200,
        include: {
            employee: true,
            user: true
        }
    });
}

function getActionBadge(action: string) {
    switch (action) {
        case "PROGRAMACAO_FERIAS":
            return <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 font-bold text-[10px]">PROGRAMAÇÃO DE FÉRIAS</Badge>;
        case "ALTERACAO_FERIAS":
            return <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 font-bold text-[10px]">ALTERAÇÃO DE FÉRIAS</Badge>;
        case "CANCELAMENTO_FERIAS":
            return <Badge className="bg-rose-500/15 text-rose-700 border-rose-300 font-bold text-[10px]">CANCELAMENTO DE FÉRIAS</Badge>;
        case "INICIO_AUTOMATICO_FERIAS":
            return <Badge className="bg-amber-500/15 text-amber-800 border-amber-300 font-bold text-[10px]">INÍCIO DE FÉRIAS (AUTO)</Badge>;
        case "RETORNO_AUTOMATICO_FERIAS":
            return <Badge className="bg-emerald-500/15 text-emerald-800 border-emerald-300 font-bold text-[10px]">RETORNO DE FÉRIAS (AUTO)</Badge>;
        case "LOTACAO":
            return <Badge className="bg-blue-500/15 text-blue-700 border-blue-300 font-bold text-[10px]">ALOCAÇÃO EM POSTO</Badge>;
        case "REALOCACAO":
            return <Badge className="bg-indigo-500/15 text-indigo-700 border-indigo-300 font-bold text-[10px]">REALOCAÇÃO DE POSTO</Badge>;
        case "DESVINCULACAO":
            return <Badge className="bg-slate-500/15 text-slate-700 border-slate-300 font-bold text-[10px]">DESVINCULAÇÃO DE POSTO</Badge>;
        case "ALTERACAO_SALARIAL":
            return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 font-bold text-[10px]">AJUSTE SALARIAL</Badge>;
        case "PROMOCAO_CARGO":
            return <Badge className="bg-purple-500/15 text-purple-700 border-purple-300 font-bold text-[10px]">MUDANÇA DE CARGO</Badge>;
        case "MUDANCA_SITUACAO":
            return <Badge className="bg-orange-500/15 text-orange-700 border-orange-300 font-bold text-[10px]">MUDANÇA DE SITUAÇÃO</Badge>;
        case "EFETIVACAO_EXPERIENCIA":
            return <Badge className="bg-indigo-500/15 text-indigo-700 border-indigo-300 font-bold text-[10px]">EFETIVAÇÃO EXPERIÊNCIA</Badge>;
        case "DESLIGAMENTO_FINAL":
        case "INICIO_DESLIGAMENTO":
        case "RESCISAO":
            return <Badge className="bg-rose-500/15 text-rose-700 border-rose-300 font-bold text-[10px]">DESLIGAMENTO</Badge>;
        case "EPI_ENTREGA":
            return <Badge className="bg-teal-500/15 text-teal-700 border-teal-300 font-bold text-[10px]">ENTREGA DE EPI</Badge>;
        default:
            return <Badge variant="outline" className="font-mono text-[10px] uppercase bg-slate-100 text-slate-700 border-slate-200">{action}</Badge>;
    }
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
    const { search } = await searchParams;
    const logs = await getLogs(search);

    return (
        <div className="min-h-screen bg-slate-50 p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin">
                        <Button variant="outline" size="icon" className="h-9 w-9 bg-white">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Histórico de Auditoria</h1>
                        <p className="text-xs text-slate-500">Rastreabilidade completa de todas as ações de RH, Férias, Movimentações e Sistema</p>
                    </div>
                </div>
                <Link href="/api/export/logs" target="_blank">
                    <Button variant="outline" className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-semibold shadow-sm">
                        Exportar CSV
                    </Button>
                </Link>
            </div>

            <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        Logs e Atividades do Sistema ({logs.length})
                    </CardTitle>
                    <LogSearch />
                </CardHeader>
                <CardContent>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-100/70">
                                <TableRow>
                                    <TableHead className="w-[160px] text-xs font-bold text-slate-600">Data e Hora</TableHead>
                                    <TableHead className="w-[200px] text-xs font-bold text-slate-600">Usuário (Autor)</TableHead>
                                    <TableHead className="w-[220px] text-xs font-bold text-slate-600">Colaborador Impactado</TableHead>
                                    <TableHead className="w-[200px] text-xs font-bold text-slate-600">Ação</TableHead>
                                    <TableHead className="text-xs font-bold text-slate-600">Detalhes da Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                        {/* Data/Hora */}
                                        <TableCell className="font-mono text-xs text-slate-600 align-top py-3.5 whitespace-nowrap">
                                            {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                                        </TableCell>

                                        {/* Usuário Autor */}
                                        <TableCell className="align-top py-3.5">
                                            <div className="flex items-start gap-2">
                                                {log.user ? (
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 border border-slate-200">
                                                        <User className="w-3.5 h-3.5 text-primary" />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0 mt-0.5 border border-cyan-200">
                                                        <Bot className="w-3.5 h-3.5 text-cyan-600" />
                                                    </div>
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-xs">
                                                        {log.user ? log.user.name : "SISTEMA"}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {log.user ? (log.user.role || log.user.username) : "Automação / Cron"}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Colaborador */}
                                        <TableCell className="align-top py-3.5">
                                            {log.employee ? (
                                                <Link 
                                                    href={`/admin/employees/${log.employee.id}`} 
                                                    className="group flex flex-col hover:underline"
                                                >
                                                    <span className="font-semibold text-slate-800 text-xs group-hover:text-primary transition-colors">
                                                        {log.employee.name}
                                                    </span>
                                                    {log.employee.cpf && (
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            CPF: {log.employee.cpf}
                                                        </span>
                                                    )}
                                                </Link>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">
                                                    Geral do Sistema
                                                </span>
                                            )}
                                        </TableCell>

                                        {/* Ação */}
                                        <TableCell className="align-top py-3.5 whitespace-nowrap">
                                            {getActionBadge(log.action)}
                                        </TableCell>

                                        {/* Detalhes */}
                                        <TableCell className="text-xs text-slate-700 align-top py-3.5">
                                            <p className="whitespace-normal break-words max-w-[550px] leading-relaxed">
                                                {log.details}
                                            </p>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {logs.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                                            Nenhum registro encontrado para "{search}".
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
