export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { EmployeesClientPage } from "./EmployeesClientPage";
import { getCurrentUserRole } from "@/lib/auth";
import { cleanupVacantRotativoPostos } from "@/app/actions";
import { syncAdmittedCandidatesToEmployees } from "@/actions/recruitment";

async function getData() {
    try {
        await cleanupVacantRotativoPostos();
    } catch (e) {
        console.error("Error in employees page cleanup:", e);
    }

    const [employees, situations, roles, companies, postos] = await Promise.all([
        prisma.employee.findMany({
            orderBy: { name: 'asc' },
            include: {
                situation: true,
                role: true,
                company: true, // Include company info
                assignments: {
                    where: { endDate: null },
                    include: {
                        posto: {
                            include: { client: true }
                        }
                    }
                }
            }
        }),
        prisma.situation.findMany({
            orderBy: { name: 'asc' }
        }),
        prisma.role.findMany({
            orderBy: { name: 'asc' }
        }),
        prisma.company.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        }),
        prisma.posto.findMany({
            include: {
                client: {
                    include: { company: true }
                },
                role: true,
                assignments: {
                    where: {
                        OR: [
                            { endDate: null },
                            { endDate: { gt: new Date() } }
                        ]
                    }
                }
            },
            orderBy: {
                client: { name: 'asc' }
            }
        })
    ]);
    return { employees, situations, roles, companies, postos };
}

export default async function EmployeesPage() {
    const { employees, situations, roles, companies, postos } = await getData();

    const userRole = await getCurrentUserRole();

    return (
        <EmployeesClientPage
            initialEmployees={employees}
            situations={situations}
            roles={roles}
            companies={companies}
            postos={postos}
            userRole={userRole}
        />
    );
}
