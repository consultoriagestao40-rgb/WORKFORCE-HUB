import { prisma } from "@/lib/db";

/**
 * Campos que contêm arquivos em base64 (vários MB por candidato).
 * Não devem trafegar no payload RSC da tela de R&S.
 */
export const HEAVY_OMIT = { requirementsEvaluation: true, documentationFiles: true } as const;

/**
 * Recoloca versões "leves" de requirementsEvaluation (sem resumeFileBase64, com hasResumeFile)
 * e documentationFiles (valores grandes viram '__LAZY__') nos candidatos carregados com HEAVY_OMIT.
 * Os arquivos reais são buscados sob demanda (getCandidateResumeFile / getCandidateDocumentFile).
 */
export async function attachLightFields(candidates: any[]): Promise<void> {
    if (!candidates || candidates.length === 0) return;
    const ids = candidates.map(c => c.id);

    const rows = await prisma.$queryRaw<
        { id: string; ev: any; has_resume: boolean | null; docs: any }[]
    >`
        SELECT
            id,
            CASE WHEN jsonb_typeof("requirementsEvaluation"::jsonb) = 'object'
                THEN "requirementsEvaluation"::jsonb - 'resumeFileBase64'
                ELSE "requirementsEvaluation"::jsonb END AS ev,
            CASE WHEN jsonb_typeof("requirementsEvaluation"::jsonb) = 'object'
                THEN (("requirementsEvaluation"::jsonb ->> 'resumeFileBase64') IS NOT NULL)
                ELSE false END AS has_resume,
            CASE WHEN jsonb_typeof("documentationFiles"::jsonb) = 'object'
                THEN (
                    SELECT COALESCE(jsonb_object_agg(k, CASE WHEN length(v) > 2000 THEN '__LAZY__' ELSE v END), '{}'::jsonb)
                    FROM jsonb_each_text("documentationFiles"::jsonb) AS t(k, v)
                )
                ELSE NULL END AS docs
        FROM "RecruitmentCandidate"
        WHERE id = ANY(${ids}::text[])
    `;

    const map = new Map(rows.map(r => [r.id, r]));
    for (const c of candidates) {
        const r = map.get(c.id);
        if (!r) continue;
        if (r.ev && typeof r.ev === "object" && !Array.isArray(r.ev)) {
            c.requirementsEvaluation = { ...r.ev, hasResumeFile: !!r.has_resume };
        } else {
            c.requirementsEvaluation = r.ev ?? null;
        }
        c.documentationFiles = r.docs ?? null;
    }
}
