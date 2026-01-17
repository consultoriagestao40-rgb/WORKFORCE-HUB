import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { AdminLayoutWrapper } from "@/components/admin/AdminLayoutWrapper";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser();

    return (
        <AdminLayoutWrapper user={user}>
            {children}
        </AdminLayoutWrapper>
    );
}
