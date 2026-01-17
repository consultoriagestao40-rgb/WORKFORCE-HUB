import { cookies } from "next/headers";

export async function getCurrentUserRole() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("auth_session");

    if (!sessionCookie) return null;

    try {
        const sessionData = JSON.parse(Buffer.from(sessionCookie.value, "base64").toString("utf-8"));
        return sessionData.role as string;
    } catch {
        return null;
    }
}

export async function getCurrentUser() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("auth_session");

    if (!sessionCookie) return null;

    try {
        return JSON.parse(Buffer.from(sessionCookie.value, "base64").toString("utf-8"));
    } catch {
        return null;
    }
}
