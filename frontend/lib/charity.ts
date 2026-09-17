import { getAuthenticatedBackend } from "./backend";

// Charity a partner nominates in the Official Use section: a free-text
// Name / Address / Contact number (replaces the old category checkboxes).
// Persisted separately via the /charity API so every partner type shares it.
export interface CharityNomination {
  name: string;
  address: string;
  contact: string;
}

export const EMPTY_CHARITY: CharityNomination = { name: "", address: "", contact: "" };

export async function loadCharity(partnerType: string, partnerId?: number): Promise<CharityNomination> {
  if (!partnerId) return { ...EMPTY_CHARITY };
  try {
    const r: any = await getAuthenticatedBackend().charity.get({ partnerType, partnerId });
    return { name: r?.name || "", address: r?.address || "", contact: r?.contact || "" };
  } catch {
    return { ...EMPTY_CHARITY };
  }
}

// Accepts the nomination object. Old callers that still pass an array (dead
// tap-onboarding code) are treated as "no nomination" so nothing breaks.
export async function saveCharity(
  partnerType: string,
  partnerId: number | undefined,
  value?: CharityNomination | string[] | null
): Promise<void> {
  if (!partnerId) return;
  const c = value && !Array.isArray(value) ? value : EMPTY_CHARITY;
  try {
    await getAuthenticatedBackend().charity.set({
      partnerType,
      partnerId,
      name: c.name || "",
      address: c.address || "",
      contact: c.contact || "",
    });
  } catch {
    // non-fatal — never block a partner save on a charity write
  }
}
