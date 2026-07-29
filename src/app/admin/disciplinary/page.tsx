export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { getCurrentUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DisciplinaryDashboard } from "./DisciplinaryDashboard";

export default async function DisciplinaryPage() {
    const role = await getCurrentUserRole();
    // Allow admins and RH coordinators/assistants
    if (role !== 'ADMIN' && role !== 'COORD_RH' && role !== 'ASSIST_RH') {
        redirect('/admin');
    }

    const [measures, supervisors] = await Promise.all([
        prisma.disciplinaryMeasure.findMany({
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        company: { select: { name: true } }
                    }
                },
                supervisor: {
                    select: { id: true, name: true, phone: true }
                },
                createdBy: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        }),
        prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
    ]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Cobrança e Gestão de Medidas</h1>
                <p className="text-slate-500 font-medium mt-1">Acompanhe advertências e suspensões pendentes com supervisores</p>
            </div>
            
            <DisciplinaryDashboard initialMeasures={measures} supervisors={supervisors} />
        </div>
    );
}
