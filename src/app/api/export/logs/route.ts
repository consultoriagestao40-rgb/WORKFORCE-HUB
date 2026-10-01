import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
    const logs = await prisma.log.findMany({
        orderBy: { timestamp: 'desc' },
        include: {
            user: true,
            employee: true
        }
    });

    const csvHeader = "Data/Hora,Usuario_Autor,Cargo_Autor,Colaborador,CPF_Colaborador,Acao,Detalhes\n";
    const csvRows = logs.map(log => {
        const date = log.timestamp.toISOString();
        const userName = (log.user ? log.user.name : "SISTEMA").replace(/,/g, " ");
        const userRole = (log.user ? log.user.role : "SISTEMA").replace(/,/g, " ");
        const employeeName = (log.employee ? log.employee.name : "").replace(/,/g, " ");
        const employeeCpf = log.employee?.cpf || "";
        const action = log.action.replace(/,/g, " ");
        const details = log.details.replace(/,/g, ";").replace(/\n/g, " ").replace(/"/g, '""');
        return `${date},"${userName}","${userRole}","${employeeName}","${employeeCpf}","${action}","${details}"`;
    }).join("\n");

    const csvContent = "\uFEFF" + csvHeader + csvRows; // Add BOM for Excel UTF-8 compatibility

    return new NextResponse(csvContent, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="auditoria_completa_workforce.csv"',
        },
    });
}
