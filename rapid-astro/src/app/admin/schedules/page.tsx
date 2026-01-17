import { prisma } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Plus, Clock } from "lucide-react";
import { createSchedule } from "@/app/actions";
import { NewScheduleSheet } from "@/components/admin/NewScheduleSheet";
import { EditScheduleSheet } from "@/components/admin/EditScheduleSheet";
import { DeleteScheduleButton } from "@/components/admin/DeleteScheduleButton";
import { getCurrentUserRole } from "@/lib/auth";

async function getSchedules() {
    return await prisma.schedule.findMany({
        orderBy: { name: 'asc' }
    });
}

export default async function SchedulesPage() {
    const schedules = await getSchedules();
    const userRole = await getCurrentUserRole();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Escalas</h1>
                <NewScheduleSheet />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Escalas Cadastradas</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {schedules.map((schedule) => (
                                <TableRow key={schedule.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                            {schedule.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>{schedule.description}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <EditScheduleSheet schedule={schedule} />
                                            {userRole === 'ADMIN' && (
                                                <DeleteScheduleButton id={schedule.id} name={schedule.name} />
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {schedules.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-slate-500 py-6">Nenhuma escala cadastrada.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
