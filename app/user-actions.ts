"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireInternalAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/request-security";

export type UserActionState = {
  ok: boolean;
  message: string;
  temporaryPassword?: string;
};

const roles = ["internal_admin", "internal_viewer", "carrier_admin", "carrier_operator"] as const;

function textFrom(formData: FormData, key: string, maxLength = 180) {
  return String(formData.get(key) ?? "").trim().slice(0, maxLength);
}

function generatePassword() {
  return randomBytes(9).toString("base64url");
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    internal_admin: "Administrador interno",
    internal_viewer: "Leitor interno",
    carrier_admin: "Admin da transportadora",
    carrier_operator: "Operador da transportadora",
  };
  return labels[role] ?? role;
}

export async function createAppUser(_state: UserActionState, formData: FormData): Promise<UserActionState> {
  await assertSameOrigin();
  await requireInternalAdmin("/usuarios");

  const nome = textFrom(formData, "nome");
  const username = textFrom(formData, "username").toLowerCase();
  const email = textFrom(formData, "email").toLowerCase();
  const role = textFrom(formData, "role");
  const transportadoraId = textFrom(formData, "transportadoraId") || null;

  if (!nome || !username || !email) {
    return { ok: false, message: "Informe nome, usuário e e-mail." };
  }
  if (!roles.includes(role as (typeof roles)[number])) {
    return { ok: false, message: "Perfil inválido." };
  }
  if (role.startsWith("carrier_") && !transportadoraId) {
    return { ok: false, message: "Usuários de transportadora precisam de uma transportadora vinculada." };
  }

  const temporaryPassword = generatePassword();
  try {
    await prisma.appUser.create({
      data: {
        nome,
        username,
        email,
        role,
        ativo: true,
        transportadoraId: role.startsWith("carrier_") ? transportadoraId : null,
        passwordHash: hashPassword(temporaryPassword),
        passwordMustChange: true,
        passwordUpdatedAt: new Date(),
      },
    });
  } catch {
    return { ok: false, message: "Não foi possível criar. Verifique se usuário ou e-mail já existem." };
  }

  revalidatePath("/usuarios");
  return { ok: true, message: `Usuário criado como ${roleLabel(role)}.`, temporaryPassword };
}

export async function resetAppUserPassword(_state: UserActionState, formData: FormData): Promise<UserActionState> {
  await assertSameOrigin();
  const currentUser = await requireInternalAdmin("/usuarios");

  const userId = textFrom(formData, "userId", 80);
  const user = await prisma.appUser.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, message: "Usuário não encontrado." };
  if (user.id === currentUser.id) return { ok: false, message: "Use outra conta admin para redefinir sua própria senha." };

  const temporaryPassword = generatePassword();
  await prisma.appUser.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(temporaryPassword),
      passwordMustChange: true,
      passwordUpdatedAt: new Date(),
    },
  });
  await prisma.appSession.deleteMany({ where: { userId: user.id } });

  revalidatePath("/usuarios");
  return { ok: true, message: `Senha redefinida para ${user.nome}.`, temporaryPassword };
}

export async function setAppUserStatus(formData: FormData) {
  await assertSameOrigin();
  const currentUser = await requireInternalAdmin("/usuarios");

  const userId = textFrom(formData, "userId", 80);
  if (userId === currentUser.id) redirect("/usuarios");

  const ativo = textFrom(formData, "ativo") === "true";
  await prisma.appUser.update({ where: { id: userId }, data: { ativo } });
  if (!ativo) {
    await prisma.appSession.deleteMany({ where: { userId } });
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function markCredentialSent(formData: FormData) {
  await assertSameOrigin();
  const currentUser = await requireInternalAdmin("/usuarios");

  const userId = textFrom(formData, "userId", 80);
  const user = await prisma.appUser.findUnique({ where: { id: userId } });
  if (!user) redirect("/usuarios");

  await prisma.appUser.update({
    where: { id: user.id },
    data: {
      credentialSentAt: new Date(),
      credentialSentBy: currentUser.nome,
    },
  });

  await prisma.automationLog.create({
    data: {
      dataReport: new Date(),
      transportadoraId: user.transportadoraId,
      tipo: "audit",
      status: "success",
      mensagem: "Credencial marcada como enviada.",
      payload: JSON.stringify({
        userId: user.id,
        username: user.username,
        sentBy: currentUser.nome,
      }),
    },
  });

  revalidatePath("/usuarios");
  redirect("/usuarios");
}
