export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { getCurrentUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EpiDashboard } from "./EpiDashboard";

export default async function EpiPage() {
    const role = await getCurrentUserRole();
    // Allow admin, RH, and supervisors/operations roles
    if (role !== 'ADMIN' && role !== 'COORD_RH' && role !== 'ASSIST_RH' && role !== 'SUPERVISOR') {
        redirect('/admin');
    }

    const [employees, epiItems, allDeliveries] = await Promise.all([
        prisma.employee.findMany({
            where: { status: "Ativo" },
            select: {
                id: true,
                name: true,
                cpf: true,
                phone: true,
                admissionDate: true,
                extraFields: true,
                company: {
                    select: {
                        name: true
                    }
                },
                role: {
                    select: {
                        name: true
                    }
                },
                assignments: {
                    where: { endDate: null },
                    include: {
                        posto: {
                            include: {
                                role: true
                            }
                        }
                    }
                }
            },
            orderBy: { name: "asc" }
        }),
        prisma.epiItem.findMany({
            orderBy: { name: "asc" }
        }),
        prisma.epiDelivery.findMany({
            include: {
                epiItem: true,
                employee: {
                    select: {
                        name: true,
                        cpf: true,
                        company: { select: { name: true } },
                        role: { select: { name: true } }
                    }
                },
                deliveredBy: { select: { name: true } }
            },
            orderBy: { deliveryDate: "desc" }
        })
    ]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Estoque & Fichas de EPI e Uniformes</h1>
                <p className="text-slate-500 font-medium mt-1">Gerencie a entrega de equipamentos de proteção individual e vestuários de trabalho</p>
            </div>
            
            <EpiDashboard 
                initialEmployees={employees} 
                initialEpiItems={epiItems} 
                initialDeliveries={allDeliveries} 
            />
        </div>
    );
}
