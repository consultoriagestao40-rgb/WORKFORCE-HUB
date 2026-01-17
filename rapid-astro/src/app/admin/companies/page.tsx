export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewCompanySheet } from "@/components/admin/NewCompanySheet";
import { EditCompanySheet } from "@/components/admin/EditCompanySheet";
import { Building2, MapPin, NotebookTabs } from "lucide-react";

async function getCompanies() {
    try {
        return await prisma.company.findMany({
            include: { _count: { select: { clients: true } } },
            orderBy: { name: 'asc' }
        });
    } catch (e) {
        console.error("Failed to fetch companies", e);
        return [];
    }
}

export default async function CompaniesPage() {
    const companies = await getCompanies();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Minhas Empresas</h1>
                    <p className="text-slate-500">Gestão de entidades jurídicas e grupos de contratos.</p>
                </div>
                <NewCompanySheet />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Entidades Cadastradas</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Empresa</TableHead>
                                <TableHead>CNPJ</TableHead>
                                <TableHead>Endereço</TableHead>
                                <TableHead>Qtd. Clientes</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {companies.map((comp) => (
                                <TableRow key={comp.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-slate-400" />
                                            {comp.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>{comp.cnpj || '-'}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-slate-500 text-xs">
                                            <MapPin className="w-3 h-3" />
                                            {comp.address || 'Não informado'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <NotebookTabs className="w-3 h-3 text-blue-500" />
                                            {comp._count.clients} cliente(s)
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <EditCompanySheet company={comp} />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {companies.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-slate-500 py-6">Nenhuma empresa cadastrada.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
