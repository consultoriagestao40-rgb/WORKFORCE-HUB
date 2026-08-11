import { getCurrentUser } from "@/lib/auth";
import { checkHrAttendanceAccess } from "@/actions/hr-attendance";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { HrAttendanceClientPage } from "@/components/admin/hr-attendance/HrAttendanceClientPage";

export const metadata = {
    title: "Atendimento RH — WhatsApp | Workforce Hub",
    description: "Central de atendimento aos colaboradores via WhatsApp com pipeline Kanban customizável."
};

export default async function HrAttendancePage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const hasAccess = await checkHrAttendanceAccess();
    if (!hasAccess) {
        return (
            <div className="p-12 text-center">
                <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-sm border border-red-200">
                    <span className="text-4xl">🔒</span>
                    <h2 className="text-base font-bold text-slate-800 mt-2">Acesso Restrito</h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Você não possui permissão para acessar a Central de Atendimento RH. Solicite ao administrador do sistema para habilitar o seu usuário.
                    </p>
                </div>
            </div>
        );
    }

    const allUsers = await prisma.user.findMany({
        where: { isActive: true, role: { not: "CLIENTE" } },
        select: { id: true, name: true, role: true, username: true },
        orderBy: { name: "asc" }
    });

    return <HrAttendanceClientPage currentUser={user} allUsers={allUsers} />;
}
