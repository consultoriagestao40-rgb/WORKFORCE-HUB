import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get("auth_session");
    const { pathname } = request.nextUrl;

    // Public Assets, Login, Candidate Form & Disciplinary Measures Public Forms
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/static") ||
        pathname.includes(".") ||
        pathname === "/login" ||
        pathname.startsWith("/vagas") ||
        pathname.startsWith("/candidatar") ||
        pathname.startsWith("/candidatodoc") ||
        pathname.startsWith("/disciplinary-upload") ||
        pathname.startsWith("/disciplinary-print")
    ) {
        if (pathname === "/login" && sessionCookie) {
            try {
                const sessionData = JSON.parse(atob(sessionCookie.value));
                if (sessionData.role === "SUPERVISOR") {
                    return NextResponse.redirect(new URL("/mobile", request.url));
                } else if (sessionData.role === "CLIENTE") {
                    return NextResponse.redirect(new URL("/client/dashboard", request.url));
                }
                return NextResponse.redirect(new URL("/admin", request.url));
            } catch {
                return NextResponse.next();
            }
        }
        return NextResponse.next();
    }

    // Checking Authentication
    if (!sessionCookie) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Role-Based Access Control
    try {
        const value = sessionCookie.value;
        const jsonStr = atob(value);
        const sessionData = JSON.parse(jsonStr);
        const role = sessionData.role;

        // Supervisor Restriction
        if (role === "SUPERVISOR") {
            if (pathname.startsWith("/admin") || pathname.startsWith("/client")) {
                return NextResponse.redirect(new URL("/mobile", request.url));
            }
        }

        // Client Restriction
        if (role === "CLIENTE") {
            if (!pathname.startsWith("/client")) {
                return NextResponse.redirect(new URL("/client/dashboard", request.url));
            }
        }

        // Admin/RH cannot access mobile or client? No, admins can access client or mobile for testing if they want, but let's restrict clients/supervisors.

    } catch (e) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
