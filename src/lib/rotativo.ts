import { prisma } from "@/lib/db";

/**
 * Get or create the special "ROTATIVO" client and posto.
 * This is a virtual cost center where active employees without a posto are allocated.
 * 
 * @returns The Rotativo posto object with full relations
 */
export async function getOrCreateRotativoPosto() {
    // 1. Find or create ROTATIVO client
    let rotativoClient = await prisma.client.findFirst({
        where: { name: 'ROTATIVO' }
    });

    if (!rotativoClient) {
        rotativoClient = await prisma.client.create({
            data: {
                name: 'ROTATIVO',
                address: 'Centro de Custo Virtual',
                companyId: null
            }
        });
    }

    // 2. Find or create generic role
    let genericRole = await prisma.role.findFirst({
        where: { name: 'Genérico' }
    });

    if (!genericRole) {
        genericRole = await prisma.role.create({
            data: {
                name: 'Genérico',
                description: 'Cargo genérico para colaboradores no Rotativo'
            }
        });
    }

    // 3. Find or create ROTATIVO posto
    let rotativoPosto = await prisma.posto.findFirst({
        where: {
            clientId: rotativoClient.id,
            roleId: genericRole.id
        },
        include: {
            client: true,
            role: true
        }
    });

    if (!rotativoPosto) {
        rotativoPosto = await prisma.posto.create({
            data: {
                clientId: rotativoClient.id,
                roleId: genericRole.id,
                schedule: 'Variável',
                startTime: '00:00',
                endTime: '23:59',
                billingValue: 0,
                requiredWorkload: 0,
                isNightShift: false,
                baseSalary: 0,
                insalubridade: 0,
                periculosidade: 0,
                gratificacao: 0,
                outrosAdicionais: 0
            },
            include: {
                client: true,
                role: true
            }
        });
    }

    return rotativoPosto;
}
