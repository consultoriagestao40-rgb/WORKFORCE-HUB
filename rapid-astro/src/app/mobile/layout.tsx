import Link from "next/link";
import { Building2, ClipboardList, User, FileText } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser();

    return (
        <div className="flex flex-col min-h-screen bg-slate-100 pb-20">
            {/* Mobile Header */}
            <header className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-md">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">WORKFORCE HUB</h1>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Supervisor Mobile</p>
                    </div>
                    {user && (
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold border-2 border-slate-800">
                                {user.name.charAt(0)}
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 p-4">
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-50 shadow-[0_-5px_10px_rgba(0,0,0,0.05)]">
                <Link href="/mobile" className="flex flex-col items-center justify-center w-full h-full text-slate-500 hover:text-indigo-600 active:text-indigo-700">
                    <Building2 className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-semibold">Postos</span>
                </Link>
                <Link href="/mobile/alerts" className="flex flex-col items-center justify-center w-full h-full text-slate-500 hover:text-indigo-600 active:text-indigo-700">
                    <ClipboardList className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-semibold">Ocorrências</span>
                </Link>
                <Link href="/mobile/requests" className="flex flex-col items-center justify-center w-full h-full text-slate-500 hover:text-indigo-600 active:text-indigo-700">
                    <FileText className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-semibold">Solicitações</span>
                </Link>
                <Link href="/mobile/profile" className="flex flex-col items-center justify-center w-full h-full text-slate-500 hover:text-indigo-600 active:text-indigo-700">
                    <User className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-semibold">Perfil</span>
                </Link>
            </nav>
        </div>
    );
}
