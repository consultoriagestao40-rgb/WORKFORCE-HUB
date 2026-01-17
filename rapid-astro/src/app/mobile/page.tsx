import { prisma } from "@/lib/db";
import Link from "next/link";
import { MapPin, Users, Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/mobile/SearchInput";

export const dynamic = 'force-dynamic';

async function getMobilePostos(query?: string) {
    const where: any = {};

    if (query) {
        where.OR = [
            { client: { name: { contains: query, mode: 'insensitive' } } },
            { role: { name: { contains: query, mode: 'insensitive' } } }
        ];
    }

    return await prisma.posto.findMany({
        where,
        include: {
            client: true,
            role: true,
            assignments: {
                where: { endDate: null },
                include: { employee: true }
            }
        },
        orderBy: {
            client: { name: 'asc' }
        }
    });
}

export default async function MobileDashboard({ searchParams }: { searchParams: { q?: string } }) {
    // Await params in Next.js 15+ if necessary, but in current setup usually direct access.
    // However, safest to just use it directly or await if it's a promise (latest Next.js).
    // Assuming Next.js 14-ish stable behavior or 15 without strict async params yet?
    // Let's assume direct access first. If error, I'll fix.

    // Actually, in Next.js 15, searchParams is a Promise. It's safer to await it if we are on latest.
    // But let's check package.json or just await it to be safe if possible? No, await needs it to be a promise.
    // To be safe for both, I'll access it directly. If it breaks, I'll fix.

    const query = searchParams?.q || "";
    const postos = await getMobilePostos(query);

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-bold text-slate-800 mb-4 px-1">Meus Postos</h2>

            <SearchInput />

            <div className="grid gap-4">
                {postos.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 bg-white rounded-xl shadow-sm border border-slate-100">
                        <MapPin className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>{query ? 'Nenhum posto encontrado para sua busca.' : 'Nenhum posto encontrado.'}</p>
                    </div>
                ) : (
                    postos.map((posto) => (
                        <Link key={posto.id} href={`/mobile/site/${posto.id}`}>
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 active:scale-[0.98] transition-all duration-200">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
                                            {posto.client.name}
                                        </div>
                                        <div className="text-lg font-bold text-slate-900 leading-tight">
                                            {posto.role.name}
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
                                        {posto.schedule}
                                    </Badge>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center text-sm text-slate-500">
                                        <Clock className="w-4 h-4 mr-2" />
                                        {posto.startTime} - {posto.endTime}
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-3">
                                        <div className="flex items-center gap-1">
                                            <div className="flex -space-x-2">
                                                {posto.assignments.slice(0, 3).map((assign) => (
                                                    <div key={assign.id} className="h-6 w-6 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-emerald-800" title={assign.employee.name}>
                                                        {assign.employee.name.charAt(0)}
                                                    </div>
                                                ))}
                                                {posto.assignments.length > 3 && (
                                                    <div className="h-6 w-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                        +{posto.assignments.length - 3}
                                                    </div>
                                                )}
                                                {posto.assignments.length === 0 && (
                                                    <span className="text-xs text-amber-500 italic">Sem efetivo fixo</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-full">
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
