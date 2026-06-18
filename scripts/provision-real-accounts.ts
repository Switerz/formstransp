import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/passwords";

const prisma = new PrismaClient();

const carriers = [
  { nome: "J&T", slug: "jt", username: "jt" },
  { nome: "Diálogo", slug: "dialogo", username: "dialogo" },
  { nome: "Log Serviços", slug: "log-servicos", username: "log-servicos" },
  { nome: "Logan", slug: "logan", username: "logan" },
  { nome: "Gollog", slug: "gollog", username: "gollog" },
  { nome: "Diaslog", slug: "diaslog", username: "diaslog" },
  { nome: "Anjun", slug: "anjun", username: "anjun" },
] as const;

function password() {
  return randomBytes(9).toString("base64url");
}

function token() {
  return randomBytes(24).toString("hex");
}

async function main() {
  const credentials: Array<{ perfil: string; usuario: string; senha: string }> = [];

  const adminPassword = password();
  await prisma.appUser.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      email: "admin@formstransp.local",
      nome: "Admin FormsTransp",
      role: "internal_admin",
      passwordHash: hashPassword(adminPassword),
      passwordMustChange: true,
      passwordUpdatedAt: new Date(),
    },
    update: {
      nome: "Admin FormsTransp",
      role: "internal_admin",
      ativo: true,
      passwordHash: hashPassword(adminPassword),
      passwordMustChange: true,
      passwordUpdatedAt: new Date(),
    },
  });
  credentials.push({ perfil: "Interno", usuario: "admin", senha: adminPassword });

  for (const carrier of carriers) {
    const transportadora = await prisma.transportadora.upsert({
      where: { codigoSlug: carrier.slug },
      create: {
        nome: carrier.nome,
        codigoSlug: carrier.slug,
        ativo: true,
        origem: "real",
        tokenPublicoFormulario: token(),
      },
      update: {
        nome: carrier.nome,
        ativo: true,
        origem: "real",
      },
    });

    const carrierPassword = password();
    await prisma.appUser.upsert({
      where: { username: carrier.username },
      create: {
        username: carrier.username,
        email: `${carrier.slug}@formstransp.local`,
        nome: `Operação ${carrier.nome}`,
        role: "carrier_admin",
        transportadoraId: transportadora.id,
        passwordHash: hashPassword(carrierPassword),
        passwordMustChange: true,
        passwordUpdatedAt: new Date(),
      },
      update: {
        nome: `Operação ${carrier.nome}`,
        role: "carrier_admin",
        ativo: true,
        transportadoraId: transportadora.id,
        passwordHash: hashPassword(carrierPassword),
        passwordMustChange: true,
        passwordUpdatedAt: new Date(),
      },
    });

    credentials.push({ perfil: carrier.nome, usuario: carrier.username, senha: carrierPassword });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(process.cwd(), ".generated");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `credenciais-${stamp}.txt`);
  const body = [
    "Credenciais geradas para FormsTransp",
    "Guarde este arquivo fora do repositório antes de compartilhar com terceiros.",
    "",
    ...credentials.map((item) => `${item.perfil}\nusuario: ${item.usuario}\nsenha: ${item.senha}\n`),
  ].join("\n");

  writeFileSync(file, body, "utf8");
  console.log(`Contas provisionadas: ${credentials.length}. Arquivo: ${file}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
