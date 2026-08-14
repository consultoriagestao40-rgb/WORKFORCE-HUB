export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { RolesManagerClient } from "@/components/admin/roles/RolesManagerClient";

async function getRoles() {
    return await prisma.role.findMany({
        include: {
            _count: {
                select: { employees: true }
            }
        },
        orderBy: { name: 'asc' }
    });
}

export default async function RolesPage() {
    const roles = await getRoles();

    return <RolesManagerClient roles={roles} />;
}
