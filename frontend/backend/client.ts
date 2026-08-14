"use client";

// Hand-written replacement for the Encore-generated `~backend/client`.
//
// Same call surface the components already use (backend.accommodation.list(),
// backend.restaurant.listByMunicipality({ area }), backend.auth.accessCodeLogin(...),
// etc.), but implemented as plain fetch calls to the pure-Go backend.
//
// Auth model (see project README):
//   - Authorization: Bearer <go-token>   -> the token the Go API validates,
//     issued by the access-code / secondary / local-guest login step and stored
//     in localStorage("token"). This is the authorization/routing layer.
//   - X-Supabase-Token: <supabase-jwt>   -> the identity layer, forwarded so the
//     Go backend can additionally verify the Supabase session once it's wired to.
//
// To make the Supabase JWT the primary bearer instead, swap the two headers
// below (and update the Go middleware to validate Supabase tokens).

import { getBackendToken, getSupabaseAccessToken } from "@/lib/session";

const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ||
  "http://localhost:4000";

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOpts {
  query?: Query;
  body?: unknown;
}

export class APIError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.code = code;
  }
}

async function request<T = any>(
  method: string,
  path: string,
  opts: RequestOpts = {}
): Promise<T> {
  const url = new URL(BASE_URL + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const goToken = getBackendToken();
  if (goToken) headers["Authorization"] = `Bearer ${goToken}`;

  try {
    const supaToken = await getSupabaseAccessToken();
    if (supaToken) headers["X-Supabase-Token"] = supaToken;
  } catch {
    /* identity token is best-effort */
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) || res.statusText || "Request failed";
    throw new APIError(message, res.status, data?.code);
  }
  return data as T;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// Build the standard CRUD + partner-code + import/export surface shared by
// restaurant / service / attraction. `singular` is the route base and
// `deleteKey`/`exportKey`/`importKey` match the Go handler method names the
// components call.
function partnerEntity(
  singular: "restaurant" | "service" | "attraction",
  keys: { del: string; export: string; import: string; getIdParam?: string }
) {
  const base = `/${singular}`;
  // Restaurant's backend Get uses a plain numeric "id". Service and
  // Attraction instead use a string serviceId/attractionId (see
  // app/service/types.go, app/attraction/types.go) — this was previously
  // hardcoded to "id" for all three, which silently sent nothing useful for
  // Service/Attraction and broke Restaurant's own form too (it was calling
  // with a mismatched property name on top of that — see RestaurantForm.tsx).
  const idParam = keys.getIdParam ?? "id";
  const api: Record<string, (arg?: any) => Promise<any>> = {
    list: (req?: any) =>
      request("GET", base, { query: { sortBy: req?.sortBy, sortOrder: req?.sortOrder } }),
    listByMunicipality: (req: any) =>
      request("GET", `${base}/by-municipality`, { query: { area: req?.area } }),
    listNearby: (req: any) =>
      request("GET", `${base}/nearby`, {
        query: {
          latitude: req?.latitude,
          longitude: req?.longitude,
          radiusKm: req?.radiusKm,
        },
      }),
    get: (req: any) => request("GET", `${base}/get`, { query: { [idParam]: req?.[idParam] } }),
    create: (req: any) => request("POST", base, { body: req }),
    update: (req: any) => request("PUT", base, { body: req }),
    getPartnerCode: (req: any) =>
      request("GET", `${base}/partner-code`, { query: { id: req?.id } }),
    regeneratePartnerCode: (req: any) =>
      request("POST", `${base}/partner-code/regenerate`, { body: req }),
    togglePartnerCode: (req: any) =>
      request("POST", `${base}/partner-code/toggle`, { body: req }),
    template: () => request("GET", `${base}/template`),
  };
  // delete/export/import are named per entity (deleteRestaurant, exportServices…)
  api[keys.del] = (req: any) => request("DELETE", base, { body: req });
  api[keys.export] = () => request("GET", `${base}/export`);
  api[keys.import] = (req: any) => request("POST", `${base}/import`, { body: req });
  return api;
}

export const backend = {
  auth: {
    accessCodeLogin: (req: { accessCode: string }) =>
      request("POST", "/auth/access-code-login", { body: req }),
    secondaryLogin: (req: any) =>
      request("POST", "/auth/secondary-login", { body: req }),
    localGuestLogin: (req: any) =>
      request("POST", "/auth/local-guest-login", { body: req }),
    // SuperAdmin (email + password) and Rep (full name + rep code) sign-in.
    login: (req: any) => request("POST", "/auth/login", { body: req }),
    repLogin: (req: { fullName: string; repCode: string }) =>
      request("POST", "/auth/rep-login", { body: req }),
    accLogin: (req: { accessCode: string }) =>
      request("POST", "/auth/acc-login", { body: req }),
    createRep: (req: { fullName: string; email?: string }) =>
      request("POST", "/auth/create-rep", { body: req }),
    listReps: () => request("GET", "/auth/reps"),
    updateRep: (req: {
      repCode: string;
      uplineRepCode: string;
      isTeamLeader: boolean;
      region: string;
      province: string;
      status: string;
      email: string;
    }) => request("POST", "/auth/rep/update", { body: req }),
    // Accountant access code (SuperAdmin only). setAccCode stores a bcrypt hash
    // server-side; accCodeStatus never returns the code itself.
    setAccCode: (req: { code: string }) =>
      request("POST", "/auth/acc-code/set", { body: req }),
    accCodeStatus: () => request("GET", "/auth/acc-code/status"),
  },
  billing: {
    listSubscriptions: () => request("GET", "/billing/subscriptions"),
    listInvoices: () => request("GET", "/billing/invoices"),
    listCommissions: () => request("GET", "/billing/commissions"),
    statement: (req: { period?: string }) =>
      request("GET", "/billing/statement", { query: req }),
    markPeriodPaid: (req: { period: string; repCode?: string }) =>
      request("POST", "/billing/statement/mark-paid", { body: req }),
    emailStatements: (req: { period?: string }) =>
      request("POST", "/billing/statement/email", { body: req }),
    setSubscriptionStatus: (req: { id: number; status: string }) =>
      request("POST", "/billing/subscription/status", { body: req }),
    getInvoiceSettings: () => request("GET", "/billing/invoice-settings"),
    setInvoiceSettings: (req: any) => request("POST", "/billing/invoice-settings", { body: req }),
    invoicePreview: () => request("GET", "/billing/invoice-preview"),
  },

  analytics: {
    repActivity: () => request("GET", "/analytics/rep-activity"),
    reps: () => request("GET", "/analytics/reps"),
    business: () => request("GET", "/analytics/business"),
    events: () => request("GET", "/analytics/events"),
    listingViews: (req: { entityType: string; entityId: number }) =>
      request("GET", "/analytics/listing-views", { query: req }),
  },
  events: {
    record: (req: {
      eventType: string;
      actorType?: string;
      code?: string;
      entityType?: string;
      entityId?: number;
      area?: string;
      province?: string;
      searchTerm?: string;
    }) => request("POST", "/events", { body: req }),
  },
  redemption: {
    start: (req: { entityType: string; entityId: number }) =>
      request("POST", "/redemption/start", { body: req }),
    redeem: (req: { token: string }) =>
      request("POST", "/redemption/redeem", { body: req }),
  },
  accounts: {
    invoices: () => request("GET", "/accounts/invoices"),
    summary: () => request("GET", "/accounts/summary"),
    setInvoiceStatus: (req: { id: number; status: string }) =>
      request("POST", "/accounts/invoice-status", { body: req }),
    commissions: () => request("GET", "/accounts/commissions"),
    bookings: () => request("GET", "/accounts/bookings"),
  },

  accommodation: {
    list: (req?: any) =>
      request("GET", "/accommodation", {
        query: { sortBy: req?.sortBy, sortOrder: req?.sortOrder },
      }),
    get: (req: any) => request("GET", "/accommodation/get", { query: { id: req?.id } }),
    create: (req: any) => request("POST", "/accommodation", { body: req }),
    update: (req: any) => request("PUT", "/accommodation", { body: req }),
    deleteAccommodation: (req: any) =>
      request("DELETE", "/accommodation", { body: req }),
    template: () => request("GET", "/accommodation/template"),
    exportAccommodations: () => request("GET", "/accommodation/export"),
    importAccommodations: (req: any) =>
      request("POST", "/accommodation/import", { body: req }),
  },

  restaurant: partnerEntity("restaurant", {
    del: "deleteRestaurant",
    export: "exportRestaurants",
    import: "importRestaurants",
    getIdParam: "id",
  }),
  service: partnerEntity("service", {
    del: "deleteService",
    export: "exportServices",
    import: "importServices",
    getIdParam: "serviceId",
  }),
  attraction: partnerEntity("attraction", {
    del: "deleteAttraction",
    export: "exportAttractions",
    import: "importAttractions",
    getIdParam: "attractionId",
  }),

  storage: {
    upload: (req: any) => request("POST", "/storage/upload", { body: req }),
    getLogo: () => request("GET", "/storage/logo"),
    setLogo: (req: any) => request("POST", "/storage/logo", { body: req }),
    getProfileSettings: () => request("GET", "/storage/profile-settings"),
    setProfileSettings: (req: any) =>
      request("PUT", "/storage/profile-settings", { body: req }),
  },

  stats: {
    get: () => request("GET", "/stats"),
  },

  rating: {
    // One vote per guest per partner, enforced server-side — see
    // app/rating/rating.go. entityType is "restaurant" | "service" |
    // "attraction"; entityId is the numeric id (not the string
    // serviceId/attractionId used elsewhere).
    submitRating: (req: { entityType: string; entityId: number; stars: number }) =>
      request("POST", "/rating/submit", { body: req }),
    listSummaries: (req: { entityType: string; entityIds: number[] }) =>
      request("POST", "/rating/summaries", { body: req }),
  },

  booking: {
    create: (req: any) => request("POST", "/booking", { body: req }),
    mine: (req: any) => request("GET", "/booking/mine", { query: { email: req?.email } }),
    forPartner: (req: any) => request("GET", "/booking/for-partner", { query: { entityType: req?.entityType, entityId: req?.entityId } }),
    cancel: (req: any) => request("POST", "/booking/cancel", { body: req }),
    update: (req: any) => request("POST", "/booking/update", { body: req }),
  },

  // Partner "edit code" — a secret (separate from the partner/view code) that
  // lets a partner unlock editing of their own profile. get/regenerate are
  // admin-only; verify is what the partner calls before the edit form opens.
  editCode: {
    get: (req: any) => request("GET", "/edit-code", { query: { entityType: req?.entityType, entityId: req?.entityId } }),
    regenerate: (req: any) => request("POST", "/edit-code/regenerate", { body: req }),
    verify: (req: any) => request("POST", "/edit-code/verify", { body: req }),
  },
};

export default backend;
