"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import type { AgeBand } from "@/lib/llm/types";

export async function upsertHousehold(formData: FormData) {
  const userId = await requireUserId();

  const homeBase = String(formData.get("homeBase") ?? "").trim();
  if (!homeBase) {
    throw new Error("Enter your home base (city, country) so we can find nearby trip options.");
  }
  const budgetMinRaw = formData.get("budgetMin");
  const budgetMaxRaw = formData.get("budgetMax");
  const budgetCurrency = String(formData.get("budgetCurrency") ?? "").trim().toUpperCase() || null;
  const tripLengthMaxDays = Number(formData.get("tripLengthMaxDays") ?? 7) || 7;
  const mustAvoids = String(formData.get("mustAvoids") ?? "").trim() || null;

  await prisma.household.upsert({
    where: { userId },
    create: {
      userId,
      homeBase,
      budgetMin: budgetMinRaw ? Number(budgetMinRaw) : null,
      budgetMax: budgetMaxRaw ? Number(budgetMaxRaw) : null,
      budgetCurrency,
      tripLengthMaxDays,
      mustAvoids,
    },
    update: {
      homeBase,
      budgetMin: budgetMinRaw ? Number(budgetMinRaw) : null,
      budgetMax: budgetMaxRaw ? Number(budgetMaxRaw) : null,
      budgetCurrency,
      tripLengthMaxDays,
      mustAvoids,
    },
  });

  revalidatePath("/household");
  revalidatePath("/onboarding");
}

export async function addKid(formData: FormData) {
  const userId = await requireUserId();

  const label = String(formData.get("label") ?? "").trim();
  const ageBand = String(formData.get("ageBand") ?? "") as AgeBand;

  if (!label || !["BABY", "TODDLER", "PRESCHOOLER"].includes(ageBand)) {
    throw new Error("Invalid kid details");
  }

  const household = await prisma.household.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  await prisma.kid.create({
    data: { householdId: household.id, label, ageBand },
  });

  revalidatePath("/household");
  revalidatePath("/onboarding");
}

export async function removeKid(kidId: string) {
  const userId = await requireUserId();

  const kid = await prisma.kid.findUnique({
    where: { id: kidId },
    include: { household: true },
  });
  if (!kid || kid.household.userId !== userId) {
    throw new Error("Not found");
  }

  await prisma.kid.delete({ where: { id: kidId } });

  revalidatePath("/household");
  revalidatePath("/onboarding");
}
