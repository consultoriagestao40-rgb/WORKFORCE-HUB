export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogSearch } from "@/components/admin/LogSearch";

async function getLogs(search?: string) {
    const where: any = {};

    if (search) {
        where.OR = [
            { action: { contains: search, mode: 'insensitive' } },
            { details: { contains: search, mode: 'insensitive' } }
            // Note: Cannot search by User Author yet as it's not in schema
        ];
    }

    return await prisma.log.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: 100,
        include: {
            employee: true,
            user: true
        }
    });
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
                    <h1 className="text-2xl font-bold text-slate-800">Histórico de Auditoria</h1>
                </div>
                <Link href="/api/export/logs" target="_blank">
                    <Button variant="outline" className="bg-white hover:bg-slate-50">Exportar CSV</Button>
                </Link>
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-base font-bold text-slate-700">Logs do Sistema</CardTitle>
                    <LogSearch />
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[180px]">Data/Hora</TableHead>
                                    <TableHead className="w-[250px]">Usuário (Autor)</TableHead>
                                    <TableHead className="w-[200px]">Ação</TableHead>
                                    <TableHead>Detalhes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-slate-50">
                                        <TableCell className="font-mono text-xs text-slate-500 align-top py-4">
                                            {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                                        </TableCell>
                                        <TableCell className="align-top py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-xs uppercase">
                                                    {log.user ? log.user.name : "SISTEMA"}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {log.user ? log.user.username : "@system.bot"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="align-top py-4">
                                            <Badge variant="outline" className="font-mono text-[10px] uppercase bg-slate-100 text-slate-600 border-slate-200 whitespace-nowrap">
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600 align-top py-4">
                                            <p className="whitespace-normal break-words max-w-[600px] leading-relaxed">
                                                {log.details}
                                            </p>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {logs.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-12 text-slate-500">
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
