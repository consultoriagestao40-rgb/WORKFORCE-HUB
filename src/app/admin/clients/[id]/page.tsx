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
import { AssignmentDialog } from "@/components/admin/AssignmentDialog";
import { EditPostoSheet } from "@/components/admin/EditPostoSheet";
import { getCurrentUserRole } from "@/lib/auth";
import { DeletePostoButton } from "@/components/admin/DeletePostoButton";

async function getClientDetails(id: string) {
    return await prisma.client.findUnique({
        where: { id },
        include: {
            postos: {
                include: {
                    role: true,
                    assignments: {
                        where: { endDate: null },
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

export default async function ClientPostosPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;

    // Parallelize data fetching
    const [client, employees, schedules, roles, userRole] = await Promise.all([
        getClientDetails(params.id),
        getActiveEmployees(),
        getSchedules(),
        getRoles(),
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

            <Card>
                <CardHeader>
                    <CardTitle>Postos Contratados</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cargo</TableHead>
                                <TableHead>Escala</TableHead>
                                <TableHead>Carga</TableHead>
                                <TableHead>Horário</TableHead>
                                <TableHead>Ocupante Atual</TableHead>
                                <TableHead>Faturamento</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {client.postos.map((posto) => {
                                const currentAssignment = posto.assignments[0]; // Since we filtered by endDate: null
                                const activeEmployee = currentAssignment?.employee as any;

                                const today = new Date();
                                today.setHours(0, 0, 0, 0);

                                let statusAlert = null;

                                if (activeEmployee) {
                                    // Check Vacation
                                    const activeVacation = activeEmployee.vacations?.find((v: any) =>
                                        new Date(v.startDate) <= today && new Date(v.endDate) >= today
                                    );

                                    if (activeVacation) {
                                        statusAlert = (
                                            <span className="flex items-center gap-1 text-[10px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded-md mt-1 w-fit">
                                                🏖️ Em Férias (até {activeVacation.endDate.toLocaleDateString('pt-BR')})
                                            </span>
                                        );
                                    }
                                    // Check Situation (if not Active and not Vacation - or both)
                                    else if (activeEmployee.situation && activeEmployee.situation.name !== 'Ativo' && activeEmployee.situation.name !== 'Em Férias') {
                                        statusAlert = (
                                            <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded-md mt-1 w-fit">
                                                ⚠️ {activeEmployee.situation.name}
                                            </span>
                                        );
                                    }
                                }

                                return (
                                    <TableRow key={posto.id} className={statusAlert ? "bg-red-50/30" : ""}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-1 group">
                                                {posto.role.name}
                                                <EditPostoSheet posto={posto} schedules={schedules} roles={roles} />
                                            </div>
                                        </TableCell>
                                        <TableCell>{posto.schedule}</TableCell>
                                        <TableCell>{posto.requiredWorkload}h</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{posto.startTime} - {posto.endTime}</span>
                                                {posto.isNightShift && <span className="text-[10px] text-purple-600 font-bold uppercase">Noturno</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {activeEmployee ? (
                                                <div className="flex flex-col">
                                                    <Link href={`/admin/employees/${activeEmployee.id}`} className="text-blue-600 hover:underline font-medium">
                                                        {activeEmployee.name}
                                                    </Link>
                                                    <span className="text-[10px] text-slate-400">Carga: {activeEmployee.workload}h</span>
                                                    {statusAlert}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="text-slate-400 italic">Vago</span>
                                                    <span className="text-[10px] text-red-500 font-bold">Necessita Cobertura</span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>R$ {posto.billingValue.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">
                                            <AssignmentDialog
                                                postoId={posto.id}
                                                postoRole={posto.role.name}
                                                activeEmployeeName={activeEmployee?.name}
                                                employees={employees}
                                            />

                                            {activeEmployee && (
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button size="sm" variant="outline" className="ml-2 gap-2 text-blue-600 hover:text-blue-700">
                                                            <Calendar className="w-3 h-3" />
                                                            Escala
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Calendário de Trabalho</DialogTitle>
                                                            <DialogDescription>
                                                                Visualização da escala <strong>{posto.schedule}</strong> iniciada em {new Date(currentAssignment.startDate).toLocaleDateString('pt-BR')}.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="flex justify-center py-4">
                                                            <CalendarView
                                                                scheduleType={posto.schedule}
                                                                startDate={currentAssignment.startDate.toISOString()}
                                                            />
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            )}

                                            {userRole === 'ADMIN' && (
                                                <DeletePostoButton
                                                    postoId={posto.id}
                                                    postoRole={posto.role.name}
                                                />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {client.postos.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-slate-500 py-6">Nenhum posto cadastrado.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div >
    );
}
