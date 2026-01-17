import { prisma } from "@/lib/db";
import { DimensionamentoClient } from "@/components/admin/DimensionamentoClient";

async function getVacancyData() {
    // Get all Postos with relationships
    const postos = await prisma.posto.findMany({
        include: {
            client: { include: { company: true } },
            assignments: {
                where: { endDate: null }, // Only active assignments
                select: { id: true }
            }
        },
        orderBy: {
            client: { name: 'asc' }
        }
    });

    // Group by Client (Contract)
    const grouped = postos.reduce((acc: any, posto: any) => {
        const clientName = posto.client.name;
        const companyName = posto.client.company?.name || 'Sem Empresa';
        const key = `${companyName}-${clientName}`;

        if (!acc[key]) {
            acc[key] = {
                companyName,
                clientName,
                totalPostos: 0,
                occupiedPostos: 0,
                difference: 0
            };
        }

        acc[key].totalPostos++;
        if (posto.assignments.length > 0) {
            acc[key].occupiedPostos++;
        }

        return acc;
    }, {});

    return Object.values(grouped).map((item: any) => ({
        ...item,
        difference: item.occupiedPostos - item.totalPostos
    })).sort((a: any, b: any) => a.difference - b.difference);
}

export default async function DimensionamentoPage() {
    const data = await getVacancyData();

    return (
        <DimensionamentoClient data={data} />
    );
}
