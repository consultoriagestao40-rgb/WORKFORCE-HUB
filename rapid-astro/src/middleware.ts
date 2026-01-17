import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get("auth_session");
    const { pathname } = request.nextUrl;

    // Public Assets & Login
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/static") ||
        pathname.includes(".") ||
        pathname === "/login"
    ) {
        if (pathname === "/login" && sessionCookie) {
            return NextResponse.redirect(new URL("/admin", request.url));
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
        // Decode base64 
        // Note: Buffer is not always available in Edge middleware depending on Next.js version.
        // using atob for compatibility.
        const jsonStr = atob(value);
        const sessionData = JSON.parse(jsonStr);
        const role = sessionData.role;

        // Supervisor Restriction
        if (role === "SUPERVISOR") {
            if (pathname.startsWith("/admin")) {
                return NextResponse.redirect(new URL("/mobile", request.url));
            }
            // Allow access to /mobile and root
        }

        // Admin/RH can access everything.

    } catch (e) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
