export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { EmployeesClientPage } from "./EmployeesClientPage";
import { getCurrentUserRole } from "@/lib/auth";

async function getData() {
    let data = { employees: [], situations: [], roles: [], companies: [] };
    try {
        const [employees, situations, roles, companies] = await Promise.all([
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
            })
        ]);
        // @ts-ignore
        data = { employees, situations, roles, companies };
    } catch (e) {
        console.error("Failed to fetch employees data", e);
    }
    return data;
}

export default async function EmployeesPage() {
    const { employees, situations, roles, companies } = await getData();

    const userRole = await getCurrentUserRole();

    return (
        <EmployeesClientPage
            initialEmployees={employees}
            situations={situations}
            roles={roles}
            companies={companies}
            userRole={userRole}
        />
    );
}
