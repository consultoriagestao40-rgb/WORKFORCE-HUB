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
import { ClientConfigTabs } from "@/components/admin/ClientConfigTabs";

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
            },
            npsQuestions: {
                orderBy: { createdAt: "asc" }
            },
            slaConfigItems: {
                include: { monthlyValues: true },
                orderBy: { createdAt: "asc" }
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
                    <p className="text-slate-500 text-sm">Gerenciamento de Vagas, SLA e NPS do Contrato</p>
                </div>
            </div>

            <ClientConfigTabs
                client={client}
                employees={employees}
                schedules={schedules}
                roles={roles}
                situations={situations}
                userRole={userRole || ""}
                initialNpsQuestions={client.npsQuestions}
                initialSlaConfigs={client.slaConfigItems}
            />
        </div>
    );
}
