const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting Candidate Vacancy ID restoration...");
  const candidates = await prisma.recruitmentCandidate.findMany({
    include: {
      timeline: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  console.log(`Found ${candidates.length} candidates.`);
  let restoredCount = 0;

  for (const candidate of candidates) {
    const creationTimeline = candidate.timeline.find(t => t.action === 'CREATED' && t.vacancyId) 
      || candidate.timeline.find(t => t.vacancyId);

    if (creationTimeline) {
      const originalVacancyId = creationTimeline.vacancyId;
      if (candidate.vacancyId !== originalVacancyId) {
        console.log(`Restoring Candidate "${candidate.name}" (${candidate.id}) to original Vacancy "${originalVacancyId}" (was "${candidate.vacancyId}")`);
        await prisma.recruitmentCandidate.update({
          where: { id: candidate.id },
          data: { vacancyId: originalVacancyId }
        });
        restoredCount++;
      } else {
        console.log(`Candidate "${candidate.name}" is already linked to their original vacancy.`);
      }
    } else {
      console.log(`No timeline vacancy reference found for candidate "${candidate.name}" (${candidate.id}).`);
    }
  }

  console.log(`Restoration complete. Restored ${restoredCount} candidates.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
