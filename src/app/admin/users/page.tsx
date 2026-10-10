export const dynamic = "force-dynamic";

import { getUsers } from "@/app/actions";
import { getApprovalWorkflowRules } from "@/actions/approvals";
import { getCurrentUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AccessManagementClient } from "@/components/admin/access/AccessManagementClient";

export default async function UsersPage() {
    const role = await getCurrentUserRole();
    if (role !== 'ADMIN') redirect('/admin');

    const [users, rules, clientsList] = await Promise.all([
        getUsers(),
        getApprovalWorkflowRules(),
        prisma.client.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true }
        })
    ]);

    return (
        <AccessManagementClient 
            users={users as any}
            rules={rules as any}
            clientsList={clientsList}
        />
    );
}
