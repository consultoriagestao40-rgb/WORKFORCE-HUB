import { prisma } from "../src/lib/db";
async function main() {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PunchInconsistencyIgnore" (
        "id" TEXT PRIMARY KEY,
        "employeeId" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "reason" TEXT,
        "userName" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PunchInconsistencyIgnore_employeeId_date_key" ON "PunchInconsistencyIgnore"("employeeId","date")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PunchInconsistencyIgnore_date_idx" ON "PunchInconsistencyIgnore"("date")`);
    console.log("ok");
    await prisma.$disconnect();
}
main();
