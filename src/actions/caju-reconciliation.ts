"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ParsedCajuItem } from "@/lib/caju-parser";
import { getBenefitsCalculation } from "@/actions/benefits";

export interface CajuReconciliationPreviewItem {
    id: string; // employeeId or temp id
    employeeId?: string;
    cpf: string;
    cajuName: string;
    wfhName?: string;
    cajuAmount: number;
    wfhExpectedAmount: number;
    difference: number;
    isPaidAlready: boolean;
    matched: boolean;
    clientName?: string;
    companyName?: string;
    postoName?: string;
    status: "READY" | "ALREADY_PAID" | "VALUE_MISMATCH" | "NOT_FOUND";
    statusMessage: string;
}

function cleanCpfDigits(cpf: string | undefined | null): string {
    return (cpf || "").replace(/\D/g, "");
}

function normalizeName(name: string | undefined | null): string {
    return (name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Pré-visualiza a conciliação do comprovante Caju contra os benefícios calculados do WFH
 */
export async function previewCajuReconciliation(params: {
    items: ParsedCajuItem[];
    month: number;
    year: number;
}): Promise<{
    previewItems: CajuReconciliationPreviewItem[];
    summary: {
        totalFileItems: number;
        readyToPayCount: number;
        alreadyPaidCount: number;
        mismatchCount: number;
        notFoundCount: number;
        totalCajuAmount: number;
    };
}> {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const { items = [], month, year } = params;

    // Fetch WFH benefits calculation for that month/year
    const calcResult = await getBenefitsCalculation(year, month);
    const wfhItems = calcResult.items || [];

    // Map WFH by clean CPF and normalized Name
    const wfhByCpf = new Map<string, typeof wfhItems[0]>();
    const wfhByName = new Map<string, typeof wfhItems[0]>();

    for (const w of wfhItems) {
        const cpfDigits = cleanCpfDigits(w.employeeCpf);
        if (cpfDigits) wfhByCpf.set(cpfDigits, w);
        const norm = normalizeName(w.employeeName);
        if (norm) wfhByName.set(norm, w);
    }

    const previewItems: CajuReconciliationPreviewItem[] = [];

    for (let i = 0; i < items.length; i++) {
        const cajuItem = items[i];
        const cpfDigits = cleanCpfDigits(cajuItem.cpf);
        const normName = normalizeName(cajuItem.employeeName);

        const wfhMatch = (cpfDigits && wfhByCpf.get(cpfDigits)) || (normName && wfhByName.get(normName));

        if (!wfhMatch) {
            previewItems.push({
                id: `caju-nf-${i}`,
                cpf: cajuItem.cpf,
                cajuName: cajuItem.employeeName || "Nome não identificado",
                cajuAmount: cajuItem.amount,
                wfhExpectedAmount: 0,
                difference: cajuItem.amount,
                isPaidAlready: false,
                matched: false,
                status: "NOT_FOUND",
                statusMessage: "Colaborador não encontrado na compra de benefícios deste mês no WFH."
            });
            continue;
        }

        const wfhExpected = wfhMatch.vaTotalValue + (wfhMatch.absenteismoAward || 0);
        const diff = Math.round((cajuItem.amount - wfhExpected) * 100) / 100;
        const isPaidAlready = !!wfhMatch.isPaid;

        let status: "READY" | "ALREADY_PAID" | "VALUE_MISMATCH" = "READY";
        let statusMessage = "Pronto para baixa no WFH.";

        if (isPaidAlready) {
            status = "ALREADY_PAID";
            statusMessage = `Já marcado como PAGO no WFH em ${wfhMatch.paidAt || "data anterior"}.`;
        } else if (Math.abs(diff) > 0.05) {
            status = "VALUE_MISMATCH";
            statusMessage = `Divergência de valor: Caju R$ ${cajuItem.amount.toFixed(2)} vs. WFH R$ ${wfhExpected.toFixed(2)} (Dif: R$ ${diff.toFixed(2)}).`;
        }

        previewItems.push({
            id: wfhMatch.employeeId,
            employeeId: wfhMatch.employeeId,
            cpf: wfhMatch.employeeCpf,
            cajuName: cajuItem.employeeName || wfhMatch.employeeName,
            wfhName: wfhMatch.employeeName,
            cajuAmount: cajuItem.amount,
            wfhExpectedAmount: wfhExpected,
            difference: diff,
            isPaidAlready,
            matched: true,
            clientName: wfhMatch.clientName,
            companyName: wfhMatch.companyName,
            postoName: wfhMatch.postoName,
            status,
            statusMessage
        });
    }

    const summary = {
        totalFileItems: items.length,
        readyToPayCount: previewItems.filter(p => p.status === "READY").length,
        alreadyPaidCount: previewItems.filter(p => p.status === "ALREADY_PAID").length,
        mismatchCount: previewItems.filter(p => p.status === "VALUE_MISMATCH").length,
        notFoundCount: previewItems.filter(p => p.status === "NOT_FOUND").length,
        totalCajuAmount: previewItems.reduce((acc, curr) => acc + curr.cajuAmount, 0)
    };

    return { previewItems, summary };
}

/**
 * Dá baixa em lote de pagamento de VA através do comprovante Caju
 */
export async function executeCajuBatchPayment(params: {
    month: number;
    year: number;
    fileName?: string;
    items: {
        employeeId: string;
        amount: number;
        cpf?: string;
        employeeName?: string;
    }[];
}): Promise<{ success: boolean; paidCount: number; totalAmount: number; error?: string }> {
    const user = await getCurrentUser();
    if (!user) throw new Error("Não autorizado.");

    const { month, year, fileName = "comprovante_caju.pdf", items = [] } = params;

    if (items.length === 0) {
        return { success: false, paidCount: 0, totalAmount: 0, error: "Nenhum colaborador selecionado para baixa." };
    }

    const config = await prisma.benefitsConfig.findFirst();
    const paidAt = new Date();
    const daysToAdd = config?.vaFractionDays || 10;
    const nextPaymentDue = new Date(paidAt);
    nextPaymentDue.setDate(nextPaymentDue.getDate() + daysToAdd);

    let paidCount = 0;
    let totalAmount = 0;

    await prisma.$transaction(async (tx) => {
        for (const item of items) {
            await tx.benefitsPayment.create({
                data: {
                    employeeId: item.employeeId,
                    month,
                    year,
                    benefitType: "VA",
                    vtAmount: 0,
                    vaAmount: Number(item.amount || 0),
                    paidAt,
                    paidByUserId: user.id,
                    nextPaymentDue,
                    notes: `Baixa automática via comprovante Caju (${fileName})`
                }
            });

            paidCount++;
            totalAmount += item.amount;
        }

        await tx.log.create({
            data: {
                action: "BAIXA_BENEFICIOS_CAJU",
                details: `Baixa em lote de ${paidCount} pagamentos de VA via comprovante Caju (${fileName}) no valor total de R$ ${totalAmount.toFixed(2)}.`,
                userId: user.id
            }
        });
    });

    revalidatePath("/admin/benefits");
    return { success: true, paidCount, totalAmount };
}
