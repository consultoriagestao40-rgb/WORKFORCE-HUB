export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Plus, ArrowLeft, UserPlus, UserMinus, Calendar } from "lucide-react";
import Link from "next/link";
import { createPosto, assignEmployee } from "@/app/actions";
import { CalendarView } from "@/components/CalendarView";
import { NewPostoSheet } from "@/components/admin/NewPostoSheet";
import { getCurrentUserRole } from "@/lib/auth";
import { ClientPostosTable } from "@/components/admin/ClientPostosTable";
import { ClientVacantPostosDialog } from "@/components/admin/ClientVacantPostosDialog";

async function getClientDetails(id: string) {
    return await prisma.client.findUnique({
        where: { id },
        include: {
            postos: {
                include: {
                    role: true,
                    assignments: {
                        include: {
                            employee: {
                                include: {
                                    vacations: true,
                                    situation: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });
}

async function getActiveEmployees() {
    return await prisma.employee.findMany({
        where: { status: 'Ativo' },
        include: { role: true },
        orderBy: { name: 'asc' }
    });
}

async function getSchedules() {
    return await prisma.schedule.findMany({
        orderBy: { name: 'asc' }
    });
}

async function getRoles() {
    return await prisma.role.findMany({
        orderBy: { name: 'asc' }
    });
}

async function getSituations() {
    return await prisma.situation.findMany({
        orderBy: { name: 'asc' }
    });
}

export default async function ClientPostosPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;

    // Parallelize data fetching
    const [client, employees, schedules, roles, situations, userRole] = await Promise.all([
        getClientDetails(params.id),
        getActiveEmployees(),
        getSchedules(),
        getRoles(),
        getSituations(),
        getCurrentUserRole()
    ]);

    if (!client) return <div>Cliente não encontrado</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin/clients">
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-800">{client.name}</h1>
                    <p className="text-slate-500 text-sm">Gerenciamento de Vagas e Postos</p>
                </div>

                <NewPostoSheet clientId={client.id} schedules={schedules} roles={roles} />
            </div>

            {/* TOTALIZERS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Total de Postos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{client.postos.length}</div>
                        <p className="text-xs text-slate-500 mt-1">
                            {client.postos.filter(p => p.assignments.some(a => !a.endDate)).length} Ocupados
                        </p>
                    </CardContent>
                </Card>

                <ClientVacantPostosDialog postos={client.postos} />

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Receita Mensal (Faturamento)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                client.postos.reduce((acc, p) => acc + p.billingValue, 0)
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Custo Salarial Estimado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                client.postos.reduce((acc, p) => acc + (p.baseSalary || 0) + (p.insalubridade || 0) + (p.periculosidade || 0) + (p.gratificacao || 0) + (p.outrosAdicionais || 0), 0)
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 italic">
                            Salário Base + Adicionais
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Postos Contratados</CardTitle>
                </CardHeader>
                <CardContent>
                    <ClientPostosTable
                        postos={client.postos}
                        employees={employees}
                        schedules={schedules}
                        roles={roles}
                        situations={situations}
                        userRole={userRole || ""}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
