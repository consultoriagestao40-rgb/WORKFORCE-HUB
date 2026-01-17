import { prisma } from "./db";

export async function getSites() {
    const sites = await prisma.client.findMany({
        include: {
            postos: {
                include: {
                    assignments: true,
                    coverages: true
                }
            }
        }
    });
    return sites;
}

export async function getPosto(id: string) {
    return await prisma.posto.findUnique({
        where: { id },
        include: {
            client: true,
            assignments: {
                include: {
                    employee: true
                }
            },
            coverages: true
        }
    });
}

export async function getEmployees() {
    return await prisma.employee.findMany();
}
