"use client";

import { useMemo, useState } from "react";
import { getAuthenticatedBackend } from "../lib/backend";

interface PreOrderItem {
  name: string;
  description?: string;
  price: number;
  leadTimeMinutes: number;
}
interface RestaurantLike {
  id: number;
  name: string;
  preOrderItems?: PreOrderItem[];
  serviceTakeaway?: boolean;
  serviceDelivery?: boolean;
}

// Guest-facing pre-order for a restaurant's takeaway/delivery items. Only shows
// the fulfilment options the restaurant actually offers, and emails the order
// to the restaurant on submit (no payment is taken in-app).
export default function RestaurantPreOrder({ restaurant }: { restaurant: RestaurantLike }) {
  const items = restaurant.preOrderItems || [];
  const fulfilOptions = useMemo(() => {
    const o: string[] = [];
    if (restaurant.serviceTakeaway) o.push("Collection");
    if (restaurant.serviceDelivery) o.push("Delivery");
    return o;
  }, [restaurant.serviceTakeaway, restaurant.serviceDelivery]);

  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [fulfilment, setFulfilment] = useState<string>(fulfilOptions[0] || "Collection");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  if (items.length === 0 || fulfilOptions.length === 0) return null;

  const total = items.reduce((sum, it) => sum + it.price * (qty[it.name] || 0), 0);
  const setItemQty = (n: string, v: number) => setQty((s) => ({ ...s, [n]: Math.max(0, v) }));

  const submit = async () => {
    setErr("");
    const chosen = items.filter((it) => (qty[it.name] || 0) > 0).map((it) => ({ name: it.name, quantity: qty[it.name] }));
    if (chosen.length === 0) { setErr("Please add at least one item."); return; }
    if (!name.trim()) { setErr("Please enter your name."); return; }
    if (!email.trim()) { setErr("Please enter your email."); return; }
    if (!date.trim()) { setErr("Please choose a preferred date."); return; }
    if (fulfilment === "Delivery" && !deliveryAddress.trim()) { setErr("Please enter a delivery address."); return; }
    setSubmitting(true);
    try {
      const backend = getAuthenticatedBackend();
      await backend.preorder.submit({
        restaurantId: restaurant.id,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
        fulfilment,
        deliveryAddress: deliveryAddress.trim(),
        preferredDate: date,
        preferredTime: time,
        items: chosen,
        notes: notes.trim(),
      });
      setDone(true);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium px-3 py-1.5 rounded-md bg-orange-50 text-orange-700 hover:bg-orange-100"
      >
        {open ? "Hide pre-order" : "Pre-order (takeaway / delivery)"}
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-border p-3 space-y-3 text-sm">
          {done ? (
            <p className="text-green-700 font-medium">Your pre-order has been sent to {restaurant.name}. They'll contact you to confirm.</p>
          ) : (
            <>
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.name} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{it.name} — R{it.price.toFixed(2)}</p>
                      {it.description ? <p className="text-xs text-muted-foreground truncate">{it.description}</p> : null}
                      {it.leadTimeMinutes > 0 ? <p className="text-xs text-muted-foreground">Ready in ~{it.leadTimeMinutes} min</p> : null}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button className="w-7 h-7 rounded border border-border" onClick={() => setItemQty(it.name, (qty[it.name] || 0) - 1)}>−</button>
                      <span className="w-6 text-center">{qty[it.name] || 0}</span>
                      <button className="w-7 h-7 rounded border border-border" onClick={() => setItemQty(it.name, (qty[it.name] || 0) + 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="font-semibold">Total: R{total.toFixed(2)}</p>

              <div className="flex gap-2">
                {fulfilOptions.map((o) => (
                  <label key={o} className="flex items-center gap-1.5">
                    <input type="radio" name={`fulfil-${restaurant.id}`} checked={fulfilment === o} onChange={() => setFulfilment(o)} />
                    {o}
                  </label>
                ))}
              </div>

              {fulfilment === "Delivery" && (
                <input className="w-full border border-border rounded-md px-3 py-2" placeholder="Delivery address"
                  value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
              )}

              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="border border-border rounded-md px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
                <input type="time" className="border border-border rounded-md px-3 py-2" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>

              <input className="w-full border border-border rounded-md px-3 py-2" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="w-full border border-border rounded-md px-3 py-2" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="w-full border border-border rounded-md px-3 py-2" placeholder="Your phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <textarea className="w-full border border-border rounded-md px-3 py-2" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

              {err ? <p className="text-red-600">{err}</p> : null}

              <button onClick={submit} disabled={submitting}
                className="w-full py-2.5 rounded-md bg-orange-600 text-white font-semibold disabled:opacity-60">
                {submitting ? "Sending…" : "Send pre-order"}
              </button>
              <p className="text-xs text-muted-foreground text-center">No payment is taken here — the restaurant confirms and arranges payment with you.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
