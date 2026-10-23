export const dynamic = "force-dynamic";
import { RecruitmentClientPage } from "@/components/admin/recruitment/RecruitmentClientPage";
import { getRecruitmentBoardData, getVacancies, getBacklogItems } from "@/actions/recruitment";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function RecruitmentPage() {
    const user = await getCurrentUser();
    if (!user) {
        redirect("/login");
    }

    try {
        const [stages, vacancies, roles, postos, companies, backlogs, users, candidates] = await Promise.all([
            getRecruitmentBoardData().catch((err) => {
                console.error("Error loading recruitment board data:", err);
                return [];
            }),
            getVacancies({ status: 'OPEN' }).catch((err) => {
                console.error("Error loading vacancies:", err);
                return [];
            }),
            prisma.role.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
            prisma.posto.findMany({ orderBy: { client: { name: 'asc' } }, select: { id: true, client: { select: { name: true } } } }),
            prisma.company.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
            getBacklogItems().catch(() => []),
            prisma.user.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
            prisma.recruitmentCandidate.findMany({
                include: {
                    stage: true,
                    vacancy: {
                        include: {
                            role: true,
                            company: true,
                            posto: { include: { client: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        const formattedPostos = postos.map(p => ({ id: p.id, name: p.client?.name || "Posto" }));

        // Garantir serialização limpa de objetos e datas para evitar falha de hidratação RSC
        const safeStages = JSON.parse(JSON.stringify(stages || []));
        const safeVacancies = JSON.parse(JSON.stringify(vacancies || []));
        const safeCandidates = JSON.parse(JSON.stringify(candidates || []));
        const safeBacklogs = JSON.parse(JSON.stringify(backlogs || []));
        const safeUser = JSON.parse(JSON.stringify(user || {}));

        return (
            <RecruitmentClientPage
                stages={safeStages}
                vacancies={safeVacancies}
                roles={roles}
                postos={formattedPostos}
                companies={companies}
                backlogs={safeBacklogs}
                recruiters={users}
                candidates={safeCandidates}
                currentUser={safeUser}
            />
        );
    } catch (error) {
        console.error("Error loading recruitment page:", error);
        return <div className="p-8 text-center text-red-600 font-bold">Erro ao carregar módulo de recrutamento. Por favor, recarregue a página.</div>;
    }
}
