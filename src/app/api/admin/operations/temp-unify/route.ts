import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PrismaClient } from "@prisma/client";

function normalize(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/[^a-z0-9]/g, "") // remove caracteres especiais e espaços
        .trim();
}

export async function GET(request: Request) {
    try {
        const reembolsoUrl = process.env.DATABASE_URL_REEMBOLSO || "postgresql://neondb_owner:npg_FAXvef5z2oLN@ep-lingering-poetry-ahaduz92-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

        const prismaReembolso = new PrismaClient({
            datasources: {
                db: {
                    url: reembolsoUrl
                }
            }
        });

        // 1. Carregar todos os clientes do Workforce Hub
        const wfhClients = await prisma.client.findMany({
            select: { id: true, name: true }
        });

        // 2. Carregar todos os postos do Reembolso Fácil
        const reembolsoPostos: any[] = await prismaReembolso.$queryRawUnsafe(
            'SELECT id, nome FROM "Posto"'
        );

        const logs: string[] = [];

        console.log(`Iniciando unificação de bases. Clientes WFH: ${wfhClients.length}, Postos Reembolso: ${reembolsoPostos.length}`);
        logs.push(`Iniciando unificação. Clientes WFH: ${wfhClients.length}, Postos Reembolso: ${reembolsoPostos.length}`);

        for (const wfhClient of wfhClients) {
            const wfhName = wfhClient.name.trim(); // Ex: "BOZA EUCALIPTO"
            const normWfh = normalize(wfhName);

            // Encontrar postos no Reembolso Fácil que correspondem a este cliente por aproximação
            const matches = reembolsoPostos.filter(p => {
                const normP = normalize(p.nome);
                // Exata ou um contido no outro (ex: "supermercadobozaeucalipto" contem "bozaeucalipto")
                return normP === normWfh || normP.includes(normWfh) || normWfh.includes(normP);
            });

            if (matches.length > 0) {
                // Verificar se já existe um posto com o nome EXATO do WFH no Reembolso Fácil
                const exactMatch = matches.find(p => p.nome === wfhName);

                if (exactMatch) {
                    // Se já existe o exato, os outros matches com nomes diferentes são duplicados antigos
                    const duplicates = matches.filter(p => p.id !== exactMatch.id);
                    for (const dup of duplicates) {
                        logs.push(`[UNIFICANDO] Movendo coberturas de "${dup.nome}" para "${exactMatch.nome}"`);
                        
                        // Migrar coberturas
                        const updateCount = await prismaReembolso.$executeRawUnsafe(
                            'UPDATE "Cobertura" SET "postoId" = $1 WHERE "postoId" = $2',
                            exactMatch.id,
                            dup.id
                        );
                        logs.push(`  -> Migradas ${updateCount} coberturas.`);

                        // Deletar o duplicado
                        await prismaReembolso.$executeRawUnsafe('DELETE FROM "_PostoToUser" WHERE "A" = $1', dup.id);
                        await prismaReembolso.$executeRawUnsafe('DELETE FROM "Posto" WHERE id = $1', dup.id);
                        logs.push(`  -> Posto antigo "${dup.nome}" deletado.`);
                    }
                } else {
                    // Se não existe o exato, pegamos o melhor match e simplesmente renomeamos para o nome exato do WFH!
                    // Evitando duplicações futuras!
                    const bestMatch = matches[0];
                    logs.push(`[PADRONIZANDO] Renomeando posto "${bestMatch.nome}" para "${wfhName}"`);
                    
                    await prismaReembolso.$executeRawUnsafe(
                        'UPDATE "Posto" SET nome = $1 WHERE id = $2',
                        wfhName,
                        bestMatch.id
                    );
                    logs.push(`  -> Sucesso.`);
                }
            }
        }

        await prismaReembolso.$disconnect();
        return NextResponse.json({ success: true, logs });
    } catch (error: any) {
        console.error("Erro na unificação:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
