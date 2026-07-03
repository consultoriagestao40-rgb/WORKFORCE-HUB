import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get("authorization");
        const expectedToken = process.env.NEXUS_API_TOKEN || "nexus-default-token";

        if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const body = await request.json();
        const { cpf, timestamp } = body;

        if (!cpf || !timestamp) {
            return NextResponse.json({ error: "CPF e Timestamp são obrigatórios" }, { status: 400 });
        }

        // Normalizar CPF (remover pontos, traços, etc)
        const cleanCpf = cpf.replace(/\D/g, "");
        const clockInTime = new Date(timestamp);
        
        // Obter data limpa (00:00:00) para chave diária
        const dateStartOfDay = new Date(clockInTime.getFullYear(), clockInTime.getMonth(), clockInTime.getDate());

        // Função auxiliar para formatar CPF com pontos e traços
        const formatCpf = (val: string) => {
            if (val.length !== 11) return val;
            return `${val.substring(0, 3)}.${val.substring(3, 6)}.${val.substring(6, 9)}-${val.substring(9)}`;
        };

        // Buscar colaborador (suportando CPF com ou sem formatação)
        const employee = await prisma.employee.findFirst({
            where: {
                OR: [
                    { cpf: cleanCpf },
                    { cpf: formatCpf(cleanCpf) }
                ]
            },
            include: {
                assignments: {
                    where: {
                        OR: [
                            { endDate: null },
                            { endDate: { gte: dateStartOfDay } }
                        ]
                    },
                    orderBy: { startDate: "desc" }
                }
            }
        });

        if (!employee) {
            return NextResponse.json({ error: "Colaborador não encontrado" }, { status: 404 });
        }

        // 1. Verificar se existe uma escala onde este funcionário foi marcado para cobrir (como Reserva)
        const coverageAttendance = await prisma.attendance.findFirst({
            where: {
                date: dateStartOfDay,
                coveredById: employee.id
            }
        });

        if (coverageAttendance) {
            const updated = await prisma.attendance.update({
                where: { id: coverageAttendance.id },
                data: {
                    status: "PRESENTE_PONTO",
                    clockInTime: clockInTime
                }
            });
            return NextResponse.json({ success: true, message: "Ponto de cobertura registrado com sucesso", data: updated });
        }

        // 2. Se não for cobertura, verificar se ele tem uma alocação ativa (titular de posto)
        const activeAssignment = employee.assignments[0];
        if (!activeAssignment) {
            return NextResponse.json({ 
                error: "Este colaborador está ativo, mas não possui posto fixo associado nem foi escalado para cobertura hoje.",
                employeeId: employee.id
            }, { status: 400 });
        }

        // Registrar presença do titular
        const attendance = await prisma.attendance.upsert({
            where: {
                postoId_date: {
                    postoId: activeAssignment.postoId,
                    date: dateStartOfDay
                }
            },
            update: {
                status: "PRESENTE_PONTO",
                clockInTime: clockInTime,
                employeeId: employee.id
            },
            create: {
                postoId: activeAssignment.postoId,
                employeeId: employee.id,
                date: dateStartOfDay,
                status: "PRESENTE_PONTO",
                clockInTime: clockInTime
            }
        });

        return NextResponse.json({ success: true, message: "Ponto registrado com sucesso", data: attendance });
    } catch (error: any) {
        console.error("Erro na API de integração Nexus:", error);
        return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 });
    }
}
