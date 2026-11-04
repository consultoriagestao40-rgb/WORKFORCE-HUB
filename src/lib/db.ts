import { PrismaClient } from "@prisma/client";

const onlyDigits = (v: unknown): string => String(v ?? "").replace(/\D/g, "");

const formatCpf = (digits: string): string =>
  `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;

// Extrai o CPF de um payload de create/update (aceita string ou { set: string })
const extractCpf = (data: any): string | undefined => {
  if (!data || data.cpf === undefined || data.cpf === null) return undefined;
  if (typeof data.cpf === "string") return data.cpf;
  if (typeof data.cpf === "object" && typeof data.cpf.set === "string") return data.cpf.set;
  return undefined;
};

function createClient() {
  const base = new PrismaClient({
    log: ["query"],
  });

  /**
   * Procura outro colaborador com o MESMO CPF (somente dígitos), independente da formatação
   * ("06968517922" == "069.685.179-22"). Lança erro se já existir.
   */
  async function assertCpfAvailable(cpf: string | undefined, ignoreEmployeeId?: string) {
    const digits = onlyDigits(cpf);
    if (digits.length !== 11) return; // CPF vazio/incompleto: validação de formato fica com o formulário

    const dup = await base.employee.findFirst({
      where: {
        cpf: { in: [digits, formatCpf(digits)] },
        ...(ignoreEmployeeId ? { id: { not: ignoreEmployeeId } } : {}),
      },
      select: { id: true, name: true, cpf: true },
    });

    if (dup) {
      throw new Error(
        `CPF ${formatCpf(digits)} já está cadastrado para "${dup.name}". Não é permitido ter dois colaboradores com o mesmo CPF.`
      );
    }
  }

  return base.$extends({
    name: "unique-cpf-guard",
    query: {
      employee: {
        async create({ args, query }) {
          await assertCpfAvailable(extractCpf(args.data));
          return query(args);
        },

        async createMany({ args, query }) {
          const rows = (Array.isArray(args.data) ? args.data : [args.data]) as any[];
          const seen = new Set<string>();
          for (const row of rows) {
            const digits = onlyDigits(extractCpf(row));
            if (digits.length !== 11) continue;
            if (seen.has(digits)) {
              throw new Error(`CPF ${formatCpf(digits)} aparece repetido no lote. Não é permitido ter dois colaboradores com o mesmo CPF.`);
            }
            seen.add(digits);
            await assertCpfAvailable(digits);
          }
          return query(args);
        },

        async update({ args, query }) {
          const newCpf = extractCpf(args.data);
          if (newCpf !== undefined) {
            const current = await base.employee.findUnique({
              where: args.where,
              select: { id: true, cpf: true },
            });
            // Só valida quando o CPF realmente muda (não bloqueia edições de cadastros já duplicados)
            if (current && onlyDigits(current.cpf) !== onlyDigits(newCpf)) {
              await assertCpfAvailable(newCpf, current.id);
            }
          }
          return query(args);
        },

        async updateMany({ args, query }) {
          if (extractCpf(args.data) !== undefined) {
            throw new Error("Alteração de CPF em lote não é permitida. Altere o CPF de um colaborador por vez.");
          }
          return query(args);
        },

        async upsert({ args, query }) {
          const existing = await base.employee.findUnique({
            where: args.where,
            select: { id: true, cpf: true },
          });
          if (existing) {
            const newCpf = extractCpf(args.update);
            if (newCpf !== undefined && onlyDigits(existing.cpf) !== onlyDigits(newCpf)) {
              await assertCpfAvailable(newCpf, existing.id);
            }
          } else {
            await assertCpfAvailable(extractCpf(args.create));
          }
          return query(args);
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createClient>;

const globalForPrisma = global as unknown as { prisma: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma || createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
