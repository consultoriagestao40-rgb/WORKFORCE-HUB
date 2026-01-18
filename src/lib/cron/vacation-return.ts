import { prisma } from "@/lib/db";
import { getOrCreateRotativoPosto } from "@/lib/rotativo";

export async function processVacationReturns() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Find employees on vacation ending yesterday (or before and not processed)
    // We look for vacations where endDate < today AND processed is false
    const vacationsToProcess = await prisma.vacation.findMany({
        where: {
            endDate: {
                lt: today
            },
            processed: false
        },
        include: {
            employee: true
        }
    });

    console.log(`Found ${vacationsToProcess.length} vacations to process`);

    const results = [];

    for (const vacation of vacationsToProcess) {
        try {
            await prisma.$transaction(async (tx) => {
                // Find the latest assignment for this employee to get originPostoId
                // The assignment created when they went on vacation should have originPostoId
                // Or we look at the 'Férias' assignment (Rotativo or otherwise) associated with this vacation period
                // Actually, the unassignEmployee action saved originPostoId on the new assignment (Rotativo)

                // Find current active assignment
                const currentAssignment = await tx.assignment.findFirst({
                    where: {
                        employeeId: vacation.employeeId,
                        endDate: null
                    },
                    include: { posto: true }
                });

                if (!currentAssignment) {
                    throw new Error(`Employee ${vacation.employee.name} has no active assignment to return from`);
                }

                const originPostoId = currentAssignment.originPostoId;
                let targetPostoId: string;
                let actionDetails: string;

                // Determine target posto
                if (originPostoId) {
                    // Check if origin posto is available
                    const isOccupied = await tx.assignment.findFirst({
                        where: {
                            postoId: originPostoId,
                            endDate: null
                        }
                    });

                    if (!isOccupied) {
                        targetPostoId = originPostoId;
                        actionDetails = `Retorno de férias para posto original`;
                    } else {
                        // Origin occupied, keep in Rotativo (or move to Rotativo if not already)
                        // But wait, if they are already in Rotativo, we just update situation?
                        // If they are in Rotativo, we might want to ensure they stay there but situation changes.
                        // Let's assume we always ensure Rotativo if origin occupied.
                        const rotativo = await getOrCreateRotativoPosto();
                        targetPostoId = rotativo.id;
                        actionDetails = `Posto original ocupado. Mantido no Rotativo.`;
                    }
                } else {
                    // No origin, go to Rotativo
                    const rotativo = await getOrCreateRotativoPosto();
                    targetPostoId = rotativo.id;
                    actionDetails = `Sem posto de origem. Alocado no Rotativo.`;
                }

                // Update Employee Situation to 'Ativo'
                // Assuming 'Ativo' situation exists and we can find it
                // Ideally use ID, but for now name lookup fallback
                const activeSituation = await tx.situation.findFirst({
                    where: { name: 'Ativo' }
                });

                if (!activeSituation) throw new Error("Situation 'Ativo' not found");

                await tx.employee.update({
                    where: { id: vacation.employeeId },
                    data: { situationId: activeSituation.id }
                });

                // Handle Assignment
                // If target is different from current, move them
                if (currentAssignment.postoId !== targetPostoId) {
                    // End current
                    await tx.assignment.update({
                        where: { id: currentAssignment.id },
                        data: { endDate: new Date() }
                    });

                    // Create new
                    await tx.assignment.create({
                        data: {
                            employeeId: vacation.employeeId,
                            postoId: targetPostoId,
                            startDate: new Date(),
                            originPostoId: null // Clear origin
                        }
                    });
                } else {
                    // Even if staying in Rotativo, we might want to clear originPostoId?
                    // Or maybe we treat "Return" as just status change.
                    // But if we want to "Process" it, we should probably clear the origin pointer so we don't try again?
                    // Actually, if they are staying in Rotativo because origin is occupied, maybe keep originPostoId?
                    // For now, let's strictly follow: Return Done -> Situation Active -> Logic Complete.
                    // If we moved them, clear origin.
                    if (currentAssignment.originPostoId) {
                        await tx.assignment.update({
                            where: { id: currentAssignment.id },
                            data: { originPostoId: null }
                        });
                    }
                }

                // Mark vacation as processed
                await tx.vacation.update({
                    where: { id: vacation.id },
                    data: { processed: true }
                });

                // Log
                await tx.log.create({
                    data: {
                        action: "RETORNO_AUTOMATICO_FERIAS",
                        details: `${vacation.employee.name}: ${actionDetails}`,
                        employeeId: vacation.employeeId
                    }
                });

                results.push({
                    employee: vacation.employee.name,
                    status: 'Success',
                    details: actionDetails
                });
            });
        } catch (error: any) {
            console.error(`Error processing return for ${vacation.employee.name}:`, error);
            results.push({
                employee: vacation.employee.name,
                status: 'Error',
                details: error.message
            });
        }
    }

    return results;
}
