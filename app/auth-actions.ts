"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSession, destroyCurrentSession, destroyOtherSessions, isInternalRole, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/request-security";

function cleanIdentifier(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase().slice(0, 180);
}

function redirectInvalid(identifier: string, next: string): never {
  const params = new URLSearchParams({ error: "invalid", next });
  if (identifier) params.set("login", identifier);
  redirect(`/login?${params.toString()}`);
}

function safeRedirectPath(value: string, fallback: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

async function requestIp() {
  const headerStore = await headers();
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "local";
}

export async function login(formData: FormData) {
  await assertSameOrigin();

  const identifier = cleanIdentifier(formData.get("identifier"));
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(String(formData.get("next") ?? "/"), "/");
  const ip = await requestIp();
  const rateLimit = checkRateLimit(`login:${ip}:${identifier || "blank"}`, 8, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    const params = new URLSearchParams({ error: "rate_limited", next });
    if (identifier) params.set("login", identifier);
    redirect(`/login?${params.toString()}`);
  }

  if (!identifier || !password) redirectInvalid(identifier, next);

  const user = await prisma.appUser.findFirst({
    where: {
      ativo: true,
      OR: [{ email: identifier }, { username: identifier }],
    },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) redirectInvalid(identifier, next);

  await prisma.appSession.deleteMany({
    where: {
      userId: user.id,
      expiresAt: { lte: new Date() },
    },
  });
  await prisma.appUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);

  if (user.passwordMustChange) {
    redirect(`/alterar-senha?next=${encodeURIComponent(next === "/" ? (isInternalRole(user.role) ? "/" : "/portal") : next)}`);
  }
  if (next !== "/") redirect(next);
  redirect(isInternalRole(user.role) ? "/" : "/portal");
}

export async function logout() {
  await destroyCurrentSession();
  redirect("/login");
}

export async function changeCurrentPassword(formData: FormData) {
  await assertSameOrigin();

  const user = await requireUser("/alterar-senha");
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const fallback = isInternalRole(user.role) ? "/" : "/portal";
  const next = safeRedirectPath(String(formData.get("next") ?? fallback), fallback);

  const fail = (error: string): never => {
    redirect(`/alterar-senha?error=${error}&next=${encodeURIComponent(next)}`);
  };

  if (!verifyPassword(currentPassword, user.passwordHash)) fail("current");
  if (newPassword.length < 10) fail("length");
  if (newPassword !== confirmPassword) fail("match");
  if (newPassword === currentPassword) fail("same");

  await prisma.appUser.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(newPassword),
      passwordMustChange: false,
      passwordUpdatedAt: new Date(),
    },
  });
  await destroyOtherSessions(user.id);

  redirect(next === "/alterar-senha" ? fallback : next);
}
