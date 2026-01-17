import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createOccurrence } from "@/app/mobile/actions-occurrences";
import { redirect } from "next/navigation";

// Since it's a mobile form, we might want to make it a Client Component for better interactivity (toast),
// or keep it Server Component with Client wrapper. For simplicity, let's use a standard Server Component layout
// wrapping a Client Form, or just a direct page if handling simple submitting.
// Let's create a Client Component for the form to handle Toasts easily.

import { NewOccurrenceForm } from "./NewOccurrenceForm";

export default async function NewOccurrencePage({ params }: { params: Promise<{ id: string }> }) {
    const { id: postoId } = await params;

    const posto = await prisma.posto.findUnique({
        where: { id: postoId },
        include: {
            client: true,
            role: true,
            assignments: {
                where: { endDate: null },
                include: { employee: true }
            }
        }
    });

    if (!posto) {
        return <div>Posto não encontrado</div>;
    }

    const employees = posto.assignments.map(a => a.employee);

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
                <Link href={`/mobile/site/${postoId}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1">
                        <ArrowLeft className="h-5 w-5 text-slate-600" />
                    </Button>
                </Link>
                <div>
                    <h1 className="font-semibold text-slate-800 leading-tight">Nova Ocorrência</h1>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{posto.client.name}</p>
                </div>
            </header>

            <main className="p-4">
                <NewOccurrenceForm postoId={postoId} employees={employees} />
            </main>
        </div>
    );
}
