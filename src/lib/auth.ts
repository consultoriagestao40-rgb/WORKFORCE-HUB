import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export async function getCurrentUserRole() {
    const user = await getCurrentUser();
    return user ? user.role : null;
}

export type CurrentUser = {
    id: string;
    name: string;
    role: string;
    clientIds: string[];
    username: string;
    email: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("auth_session");

    if (!sessionCookie) return null;

    try {
        const sessionData = JSON.parse(Buffer.from(sessionCookie.value, "base64").toString("utf-8"));
        if (!sessionData?.id) return null;

        // Sempre buscar do banco para garantir integridade rigorosa do usuário ativo logado
        const dbUser = await prisma.user.findUnique({
            where: { id: sessionData.id },
            select: { id: true, name: true, role: true, clientIds: true, isActive: true, username: true, email: true }
        });

        if (!dbUser || !dbUser.isActive) return null;

        return {
            id: dbUser.id,
            name: dbUser.name,
            role: dbUser.role as string,
            clientIds: dbUser.clientIds,
            username: dbUser.username,
            email: dbUser.email
        };
    } catch {
        return null;
    }
}
