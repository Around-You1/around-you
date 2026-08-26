import { getAuthenticatedBackend } from "./backend";

// Charity focus areas captured in the Official Use section. Persisted separately
// from the partner record via the /charity API so every partner type shares it.
export const CHARITY_CATEGORIES = ["Adults", "Children", "Animals", "Health", "Homes", "Food"];

export async function loadCharity(partnerType: string, partnerId?: number): Promise<string[]> {
  if (!partnerId) return [];
  try {
    const r: any = await getAuthenticatedBackend().charity.get({ partnerType, partnerId });
    return r.categories || [];
  } catch {
    return [];
  }
}

export async function saveCharity(partnerType: string, partnerId: number | undefined, categories: string[]): Promise<void> {
  if (!partnerId) return;
  try {
    await getAuthenticatedBackend().charity.set({ partnerType, partnerId, categories: categories || [] });
  } catch {
    // non-fatal — never block partner save on a charity write
  }
}
