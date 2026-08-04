const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function parseDateString(str) {
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const d = new Date(str + 'T12:00:00');
        return isNaN(d.getTime()) ? null : d;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        const parts = str.split('/');
        const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0);
        return isNaN(d.getTime()) ? null : d;
    }
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
}

async function main() {
    const emp = await prisma.employee.findUnique({
        where: { id: "a316bf35-6ecb-4b40-a38a-dfcc5225205a" },
        include: { role: true, situation: true }
    });

    console.log("SIMULATING UPDATE FOR:", emp.name);

    // Prepare inputs simulating what is received from the form
    const id = emp.id;
    const name = emp.name;
    const cpf = emp.cpf;
    const roleId = emp.roleId;
    const type = emp.type;
    const status = emp.status;
    const salary = emp.salary;
    const insalubridade = emp.insalubridade;
    const periculosidade = emp.periculosidade;
    const gratificacao = emp.gratificacao;
    const outrosAdicionais = emp.outrosAdicionais;
    const dependentsCount = emp.dependentsCount;
    const ajudaCusto = emp.ajudaCusto;
    const adicionalViagem = emp.adicionalViagem;
    const workload = emp.workload;
    
    // Simulate user editing the admission date to 24/07/2026
    const admissionDateStr = "24/07/2026";
    
    const situationId = emp.situationId;
    const lastVacationStartStr = null;
    const lastVacationEndStr = null;
    const totalVacationDaysTaken = emp.totalVacationDaysTaken;
    const valeAlimentacao = emp.valeAlimentacao;
    const vtOptIn = emp.vtOptIn;
    const valeTransporte = emp.valeTransporte;
    const valeTransporte2 = emp.valeTransporte2;
    const vtPaymentMethod = emp.vtPaymentMethod;
    const vtPaymentMethod2 = emp.vtPaymentMethod2;
    const vtCustomPaymentDetails = emp.vtCustomPaymentDetails;
    const vtCustomPaymentDetails2 = emp.vtCustomPaymentDetails2;
    const vaPaymentMethod = emp.vaPaymentMethod;
    const vaCustomPaymentDetails = emp.vaCustomPaymentDetails;
    const vtDiscountPercentage = emp.vtDiscountPercentage;
    const vaDiscountPercentage = emp.vaDiscountPercentage;
    const extraFields = emp.extraFields;

    const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.employee.update({
            where: { id },
            data: {
                name,
                cpf,
                roleId,
                companyId: emp.companyId,
                type,
                status,
                situationId: situationId || undefined,
                admissionDate: parseDateString(admissionDateStr) || undefined,
                lastVacationStart: parseDateString(lastVacationStartStr),
                lastVacationEnd: parseDateString(lastVacationEndStr),
                totalVacationDaysTaken,
                salary,
                insalubridade,
                periculosidade,
                gratificacao,
                outrosAdicionais,
                workload,
                dependentsCount,
                ajudaCusto,
                adicionalViagem,
                valeAlimentacao,
                valeTransporte,
                valeTransporte2,
                vtOptIn,
                vtPaymentMethod,
                vtPaymentMethod2,
                vtCustomPaymentDetails,
                vtCustomPaymentDetails2,
                vaPaymentMethod,
                vaCustomPaymentDetails,
                vtDiscountPercentage,
                vaDiscountPercentage,
                birthDate: emp.birthDate,
                gender: emp.gender,
                address: emp.address,
                phone: emp.phone,
                email: emp.email,
                dismissalReason: emp.dismissalReason,
                dismissalNotes: emp.dismissalNotes,
                extraFields: extraFields || undefined
            },
            include: { role: true, situation: true }
        });

        console.log("[TX] Employee updated successfully in database.");
        return updated;
    });

    console.log("SUCCESS:", result.name);
}

main().catch(console.error).finally(() => prisma.$disconnect());
