import { MessageCircle } from "lucide-react";

// toWhatsAppNumber converts a South African phone number into the digits wa.me
// expects (country code 27, no "+", no leading 0) — but ONLY for mobile numbers.
// WhatsApp works on mobiles only, so landlines (area codes 01x–05x), toll-free
// (0800) and share-call / VoIP (086x / 087x) return null and no button shows.
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");

  // Normalise to a local 0XXXXXXXXX form.
  let local = "";
  if (digits.startsWith("27") && digits.length === 11) {
    local = "0" + digits.slice(2); // 27821234567 -> 0821234567
  } else if (digits.startsWith("0027") && digits.length === 13) {
    local = "0" + digits.slice(4);
  } else if (digits.startsWith("0") && digits.length === 10) {
    local = digits;
  } else {
    return null; // not a recognisable SA number
  }

  const p2 = local.slice(0, 2);
  const p3 = local.slice(0, 3);
  const isMobile = p2 === "06" || p2 === "07" || ["081", "082", "083", "084", "085"].includes(p3);
  if (!isMobile) return null;

  return "27" + local.slice(1);
}

// WhatsAppButton renders a "Contact via WhatsApp" link for a mobile number, or
// nothing at all for landlines / numbers WhatsApp can't reach.
export default function WhatsAppButton({
  number,
  className = "",
}: {
  number: string | null | undefined;
  className?: string;
}) {
  const wa = toWhatsAppNumber(number);
  if (!wa) return null;
  return (
    <a
      href={`https://wa.me/${wa}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-md bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1ebe5d] transition-colors ${className}`}
    >
      <MessageCircle className="h-4 w-4" />
      Contact via WhatsApp
    </a>
  );
}
