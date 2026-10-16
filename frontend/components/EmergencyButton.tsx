"use client";

import { useState } from "react";
import { Phone, Navigation, X, Siren } from "lucide-react";
import { getAuthenticatedBackend } from "../lib/backend";

type Contact = { label: string; name?: string; number: string; address?: string; source?: string };
type EmergencyData = {
  ambulance?: Contact;
  police?: Contact;
  fire?: Contact;
  nsri?: Contact;
  snakeCatchers?: Contact;
  doctor?: Contact;
  vet?: Contact;
};

// EmergencyButton shows a prominent red button that opens a quick-dial list of
// the key emergency contacts for the viewer's postal code.
export default function EmergencyButton({
  postalCode,
  accommodationId,
}: {
  postalCode: string;
  accommodationId?: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EmergencyData | null>(null);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res: any = await getAuthenticatedBackend().emergency.contacts({
        postalCode: postalCode || "",
        accommodationId: accommodationId,
      });
      setData(res || {});
    } catch (e: any) {
      setErr(e?.message || "Couldn't load emergency numbers.");
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setOpen(true);
    load();
  };

  const order: Contact[] = data
    ? ([data.ambulance, data.police, data.fire, data.nsri, data.snakeCatchers, data.doctor, data.vet].filter(Boolean) as Contact[])
    : [];

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="w-full flex items-center justify-center gap-2 rounded-lg font-extrabold text-white"
        style={{ background: "#D21E1E", padding: "14px 16px", fontSize: 17, boxShadow: "0 2px 10px rgba(210,30,30,0.35)" }}
      >
        <Siren className="h-5 w-5" />
        Emergency
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden"
            style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ background: "#D21E1E", color: "#fff" }}>
              <div className="flex items-center gap-2 font-extrabold text-lg">
                <Siren className="h-5 w-5" /> Emergency Contacts
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-3" style={{ color: "#111" }}>
              {loading ? (
                <p className="text-sm text-gray-500 p-3">Finding the nearest emergency numbers…</p>
              ) : err ? (
                <p className="text-sm text-red-600 p-3">{err}</p>
              ) : order.length === 0 ? (
                <p className="text-sm text-gray-500 p-3">
                  No emergency numbers are listed for this area yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {order.map((c, i) => (
                    <div key={i} className="rounded-lg border p-3" style={{ borderColor: "rgba(210,30,30,0.3)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#D21E1E" }}>
                            {c.label}
                          </div>
                          {c.name ? <div className="text-sm font-medium truncate">{c.name}</div> : null}
                          <div className="text-base font-bold">{c.number}</div>
                        </div>
                        <a
                          href={`tel:${c.number}`}
                          className="flex items-center gap-1 rounded-md text-white font-bold shrink-0"
                          style={{ background: "#D21E1E", padding: "9px 14px" }}
                        >
                          <Phone className="h-4 w-4" /> Call
                        </a>
                      </div>
                      {c.address ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-sm"
                          style={{ color: "#0FB89B" }}
                        >
                          <Navigation className="h-4 w-4" /> {c.address}
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-gray-400 px-1 pt-2">
                Numbers are supplied by local listings — always confirm before relying on them in a real emergency.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
