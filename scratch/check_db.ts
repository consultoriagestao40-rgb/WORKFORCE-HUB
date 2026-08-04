import { prisma } from "../src/lib/db";

async function main() {
    const deliveries = await prisma.epiDelivery.findMany({
        where: {
            employee: {
                name: { contains: "Cristiano" }
            }
        },
        include: {
            employee: true
        }
    });

    console.log("Cristiano Deliveries:");
    for (const d of deliveries) {
        console.log(`ID: ${d.id} | Date: ${d.deliveryDate} | Signature: ${d.recipientSignature} | Employee: ${d.employee.name}`);
    }
}

main().catch(console.error);
