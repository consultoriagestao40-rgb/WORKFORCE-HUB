import { getUsers, deleteUser } from "@/app/actions";
import { UserDialog } from "@/components/admin/UserDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit2, Search, Trash2, Shield, UserCog } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getCurrentUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function UsersPage() {
    const role = await getCurrentUserRole();
    if (role !== 'ADMIN') redirect('/admin');

    const users = await getUsers();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Gestão de Acessos</h1>
                    <p className="text-slate-500 font-medium mt-1">Gerencie usuários e permissões do sistema</p>
                </div>
                <UserDialog />
            </div>

            <Card className="border-none shadow-xl bg-white/50 backdrop-blur-xl">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <UserCog className="w-5 h-5 text-indigo-600" />
                                Usuários Cadastrados
                            </CardTitle>
                            <CardDescription>
                                Total de {users.length} usuários ativos no sistema
                            </CardDescription>
                        </div>
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input placeholder="Buscar por nome ou email..." className="pl-9 bg-white border-slate-200" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-slate-100">
                                <TableHead>Nome / Email</TableHead>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Perfil</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id} className="hover:bg-slate-50/50 border-slate-50">
                                    <TableCell>
                                        <div className="font-semibold text-slate-900">{user.name}</div>
                                        <div className="text-xs text-slate-500">{user.email || "Sem email"}</div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-slate-600">
                                        @{user.username}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`
                                            ${user.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : ''}
                                            ${user.role === 'COORD_RH' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''}
                                            ${user.role === 'ASSIST_RH' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                                            ${user.role === 'SUPERVISOR' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                                        `}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={user.isActive ? "default" : "destructive"} className={user.isActive ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                                            {user.isActive ? "Ativo" : "Inativo"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <UserDialog
                                                user={user}
                                                trigger={
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50">
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                }
                                            />
                                            {/* Delete Form */}
                                            <form action={deleteUser.bind(null, user.id)}>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </form>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
