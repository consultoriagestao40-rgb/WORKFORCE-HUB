import { User, Settings, LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default async function MobileProfilePage() {
    const user = await getCurrentUser();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <Avatar className="h-16 w-16 border-4 border-indigo-50">
                    <AvatarFallback className="bg-indigo-600 text-white text-xl font-bold">
                        {user?.name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <h2 className="text-lg font-bold text-slate-900">{user?.name}</h2>
                    <p className="text-sm text-slate-500">Supervisor de Operações</p>
                </div>
            </div>

            <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start h-12 text-slate-600">
                    <Settings className="w-5 h-5 mr-3" />
                    Configurações
                </Button>

                <form action={async () => {
                    "use server";
                    const { logout } = await import("@/app/actions");
                    await logout();
                }}>
                    <Button variant="outline" className="w-full justify-start h-12 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100" type="submit">
                        <LogOut className="w-5 h-5 mr-3" />
                        Sair do App
                    </Button>
                </form>
            </div>
        </div>
    );
}
