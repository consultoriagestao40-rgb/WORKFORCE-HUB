import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const spotEmployees = await prisma.employee.findMany({
            where: {
                company: {
                    name: {
                        contains: "Spot",
                        mode: "insensitive"
                    }
                }
            },
            select: {
                name: true,
                cpf: true,
                vtPaymentMethod: true,
                urbsSic: true,
                urbsCqCtNf: true
            }
        });

        return NextResponse.json({ success: true, count: spotEmployees.length, employees: spotEmployees });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
