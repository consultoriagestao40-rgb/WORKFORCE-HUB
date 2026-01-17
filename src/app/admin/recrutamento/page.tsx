export const dynamic = "force-dynamic";
import { RecruitmentClientPage } from "@/components/admin/recruitment/RecruitmentClientPage";
import { getRecruitmentBoardData, getVacancies, getBacklogItems } from "@/actions/recruitment";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export default async function RecruitmentPage() {
    const [stages, vacancies, roles, postos, companies, backlogs, users] = await Promise.all([
        getRecruitmentBoardData(),
        getVacancies({ status: 'OPEN' }),
        prisma.role.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
        prisma.posto.findMany({ orderBy: { client: { name: 'asc' } }, select: { id: true, client: { select: { name: true } } } }),
        prisma.company.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
        getBacklogItems(),
        prisma.user.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } })
    ]);

    // Format postos for dropdown
    const formattedPostos = postos.map(p => ({ id: p.id, name: p.client.name }));

    return (
        <RecruitmentClientPage
            stages={stages}
            vacancies={vacancies}
            roles={roles}
            postos={formattedPostos}
            companies={companies}
            backlogs={backlogs}
            recruiters={users}
        />
    );
}
