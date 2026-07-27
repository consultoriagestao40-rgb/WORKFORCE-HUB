import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding database...')

    // Create Roles
    const rolePorteiro = await prisma.role.create({
        data: { name: 'Porteiro', description: 'Porteiro diurno ou noturno' }
    })

    const roleZelador = await prisma.role.create({
        data: { name: 'Zelador', description: 'Zelador de condomínio' }
    })

    const roleLimpeza = await prisma.role.create({
        data: { name: 'Auxiliar de Limpeza', description: 'Responsável pela limpeza' }
    })

    console.log('✅ Cargos criados')

    // Create Situations
    const activeStatus = await prisma.situation.create({
        data: { name: 'Ativo', color: '#10b981' }
    })

    const vacationStatus = await prisma.situation.create({
        data: { name: 'Férias', color: '#f59e0b' }
    })

    const abandonoStatus = await prisma.situation.create({
        data: { name: 'Processo de abandono', color: '#ef4444' }
    })

    console.log('✅ Situações criadas')

    // Create Company
    const company = await prisma.company.create({
        data: {
            name: 'QL FACILITIES',
            cnpj: '00.000.000/0001-00',
            address: 'Matriz'
        }
    })

    // Create Client
    const client1 = await prisma.client.create({
        data: {
            name: 'Condomínio Solar',
            address: 'Rua das Flores, 123',
            companyId: company.id
        }
    })

    console.log('✅ Cliente criado')

    // Create Postos
    const posto1 = await prisma.posto.create({
        data: {
            client: { connect: { id: client1.id } },
            role: {
                connectOrCreate: {
                    where: { name: 'Porteiro Diurno' },
                    create: { name: 'Porteiro Diurno', description: 'Porteiro horário diurno' }
                }
            },
            startTime: '07:00',
            endTime: '19:00',
            schedule: '12x36',
            billingValue: 3500.00,
            requiredWorkload: 220
        }
    })

    const posto2 = await prisma.posto.create({
        data: {
            client: { connect: { id: client1.id } },
            role: {
                connectOrCreate: {
                    where: { name: 'Porteiro Noturno' },
                    create: { name: 'Porteiro Noturno', description: 'Porteiro horário noturno' }
                }
            },
            startTime: '19:00',
            endTime: '07:00',
            schedule: '12x36',
            billingValue: 3800.00,
            requiredWorkload: 220,
            isNightShift: true
        }
    })

    console.log('✅ Postos criados')

    // Create Employees
    const emp1 = await prisma.employee.create({
        data: {
            name: 'João Silva',
            cpf: '111.111.111-11',
            roleId: rolePorteiro.id,
            situationId: activeStatus.id,
            status: 'Ativo',
            type: 'CLT',
            salary: 2500,
            workload: 220
        }
    })

    const emp2 = await prisma.employee.create({
        data: {
            name: 'Maria Santos',
            cpf: '222.222.222-22',
            roleId: roleZelador.id,
            situationId: activeStatus.id,
            status: 'Ativo',
            type: 'CLT',
            salary: 2200,
            workload: 220
        }
    })

    console.log('✅ Colaboradores criados')

    // Assign
    await prisma.assignment.create({
        data: {
            postoId: posto1.id,
            employeeId: emp1.id,
            startDate: new Date(),
        }
    })

    console.log('✅ Lotação criada')

    // Create Users
    const { createHash } = await import('node:crypto');
    function hashPassword(password: string) {
        return createHash('sha256').update(password).digest('hex');
    }

    const commonPassword = hashPassword('123456');
    const users = [
        { name: "Administrador", username: "admin", role: "ADMIN" },
        { name: "Coordenador RH", username: "coord", role: "COORD_RH" },
        { name: "Assistente RH", username: "assist", role: "ASSIST_RH" },
        { name: "Supervisor Ops", username: "supervisor", role: "SUPERVISOR" },
    ];

    for (const u of users) {
        await prisma.user.upsert({
            where: { username: u.username },
            update: {
                password: commonPassword,
                role: u.role as any
            },
            create: {
                username: u.username,
                password: commonPassword,
                name: u.name,
                role: u.role as any
            }
        });
    }

    console.log('✅ Usuários de sistema criados (admin, coord, assist, supervisor)')
    console.log('🎉 Seeding concluído com sucesso!')
}

main()
    .catch((e) => {
        console.error('❌ Erro no seeding:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
