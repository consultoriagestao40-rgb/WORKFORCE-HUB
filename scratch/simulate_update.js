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
    const id = "a316bf35-6ecb-4b40-a38a-dfcc5225205a"; // Rubia's ID
    const admissionDateStr = "2026-07-24"; // The date the user had in the input field!
    
    // Let's load Rubia's current record
    const oldEmployee = await prisma.employee.findUnique({
        where: { id },
        include: { role: true, situation: true }
    });

    console.log("OLD EMPLOYEE:", oldEmployee.name, "ADMISSION DATE:", oldEmployee.admissionDate);

    // Let's try to update the admission date using the same transaction as updateEmployee
    const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.employee.update({
            where: { id },
            data: {
                admissionDate: parseDateString(admissionDateStr) || undefined,
            },
            include: { role: true, situation: true }
        });
        return updated;
    });

    console.log("UPDATED SUCCESSFULLY:", result.name, "NEW ADMISSION DATE:", result.admissionDate);
}

main().catch(console.error).finally(() => prisma.$disconnect());
