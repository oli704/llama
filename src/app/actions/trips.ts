"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { extractTasteProfile } from "@/lib/llm/extractTasteProfile";

export async function addPastTrip(formData: FormData) {
  const userId = await requireUserId();

  const rawText = String(formData.get("rawText") ?? "").trim();
  if (rawText.length < 20) {
    throw new Error("Tell us a bit more about the trip (at least a couple of sentences).");
  }

  const trip = await prisma.pastTrip.create({
    data: { userId, rawText },
  });

  // Extraction runs right after creation so the user sees the profile to confirm/edit
  // immediately, per the design's "don't hide the extraction" requirement.
  try {
    const tasteProfile = await extractTasteProfile(rawText);
    await prisma.pastTrip.update({
      where: { id: trip.id },
      data: { tasteProfile: tasteProfile as unknown as object },
    });
  } catch (err) {
    console.error("Taste profile extraction failed", err);
  }

  revalidatePath("/trips");
}

export async function deletePastTrip(tripId: string) {
  const userId = await requireUserId();

  const trip = await prisma.pastTrip.findUnique({ where: { id: tripId } });
  if (!trip || trip.userId !== userId) {
    throw new Error("Not found");
  }

  await prisma.pastTrip.delete({ where: { id: tripId } });
  revalidatePath("/trips");
}
