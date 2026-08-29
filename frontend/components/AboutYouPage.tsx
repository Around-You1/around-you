"use client";

import { useState, useEffect, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLogo from "../components/AppLogo";
import { Facebook, Linkedin } from "lucide-react";

const LUMO = "#39FF14";
const LUMO_DARK = "#2dd10f";

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

function InfoSquareBtn({
  title,
  isOpen,
  onToggle,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      style={{
        background: "#000",
        border: `2px solid ${isOpen ? "#5fff3a" : LUMO}`,
        color: isOpen ? "#5fff3a" : LUMO,
        borderRadius: 10,
        fontWeight: 700,
        fontSize: "0.65rem",
        cursor: "pointer",
        textAlign: "center",
        letterSpacing: "0.03em",
        transition: "all 0.2s ease",
        aspectRatio: "1 / 1",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px",
        minHeight: 0,
        lineHeight: 1.25,
      }}
      className="touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1)";
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
    >
      {title}
    </button>
  );
}

export default function AboutYouPage() {
  const router = useRouter();
  const navigate = (to: string, opts?: { replace?: boolean }) =>
    opts?.replace ? router.replace(to) : router.push(to);
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);

  const accessCode = searchParams.get("accessCode");

  useEffect(() => {
    if (accessCode && accessCode.length === 12) {
      navigate(`/${accessCode}`, { replace: true });
    }
  }, [accessCode, navigate]);

  const handleLogin = () => {
    const code = searchParams.get("code");
    const role = searchParams.get("role");
    if (code) {
      const params = new URLSearchParams({ code });
      if (role) params.set("role", role);
      navigate(`/portal?${params.toString()}`);
    } else {
      navigate("/portal");
    }
  };

  const handleToggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  const sections: (Section | { id: string; title: string; href: string })[] = [
    {
      id: "about",
      title: "About Us",
      content: (
        <>
          <p>Around You welcomes guests with instant access to verified accommodation info, curated local partners, and exclusive perks.</p>
          <p>As a Holiday Guest, log in with the accommodation's unique QR Code or Access Code to unlock seamless navigation, trusted recommendations, and meaningful savings.</p>
          <p>As a Local, log in with your email address, province, and municipal area to search for restaurants, services, and attractions 'Around You.'</p>
          <p>Everything you need—where to go, what to enjoy, and how to get there—is just one tap away.</p>
          <p>It's hospitality, elevated.</p>
        </>
      ),
    },
    {
      id: "heart",
      title: "Our Values",
      content: (
        <>
          <p>We believe hospitality should go beyond the stay. That's why Around You partners with Trinity CSR, a social impact initiative committed to giving back.</p>
          <p>Through this collaboration, a portion of all platform sales supports causes that matter—like vulnerable communities, animal welfare, and grassroots organizations.</p>
        </>
      ),
    },
    {
      id: "how",
      title: "How It Works",
      content: (
        <>
          <p>Around You is designed to elevate guests' experience. It's a smart, seamless way to view all the accommodation information, connect with trusted local partners, and enjoy meaningful extras that help make your stay unforgettable.</p>
          <p>By using Around You, you unlock a powerful hospitality tool that helps you feel welcomed, informed, and connected from the moment you arrive at your accommodation.</p>
          <p>Your accommodation would have issued you a unique "Access Code" or "QR Code."</p>
          <p>Click the "Log In" button below, select the "Guest" tab, then select the "Holiday" tab, and either enter the accommodation name, address, province, and area, or enter the access code they may have sent you into the login portal. Then click the "Sign In" button.</p>
          <p>Or scan the QR Code the accommodation may have sent you. Make sure that on the Sign In page, the access code auto populates, then click the "Sign In" button.</p>
          <p>When logged in, guests instantly access:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Verified information about their accommodation</li>
          </ul>
          <p>Guests and Locals will access:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>A curated selection of nearby restaurants, wellness venues, essential services, and local attractions</li>
            <li>Exclusive discounts from select venues (redeemable via digital codes)</li>
            <li>One click navigation to partner venues and points of interest</li>
          </ul>
        </>
      ),
    },
    {
      id: "partner",
      title: "Partner With Us",
      content: (
        <>
          <p>Become part of the Around You Partner Family and choose the package that suits you best. Each package gives you access to our tools, marketing support, and exclusive partner benefits, so you can grow your reach and earnings.</p>
          <p>
            Contact us at{" "}
            <a href="mailto:partners@aroundyou.co.za" style={{ color: LUMO }} className="hover:underline">
              partners@aroundyou.co.za
            </a>
            , where we will assist you in selecting a plan, completing a questionnaire for onboarding purposes, and starting to promote right away.
          </p>
        </>
      ),
    },
    {
      id: "sales",
      title: "Become a Seller",
      content: (
        <>
          <p>Become part of our sales family and earn BIG commission on all sales every month.</p>
          <p>Your sales carry forward and compound: what you sell in Month 1 is added to your Month 2 total; Month 1 + Month 2 are added to Month 3, and so on. This means consistent selling builds larger monthly totals and bigger payouts over time.</p>
          <p>Commissions are calculated and paid at month end, so you can track your progress and rewards each pay cycle.</p>
          <p>
            Contact us at{" "}
            <a href="mailto:sales@aroundyou.co.za" style={{ color: LUMO }} className="hover:underline">
              sales@aroundyou.co.za
            </a>
            .
          </p>
        </>
      ),
    },
    { id: "support", title: "Contact Support", href: "mailto:support@aroundyou.co.za" },
  ];

  return (
    <div
      className="min-h-screen p-5 pb-20"
      style={{ background: "#0a0a0a" }}
    >
      <div className="max-w-md mx-auto space-y-5 py-8">
        <div className="flex justify-center">
          <AppLogo />
        </div>

        <div
          className="rounded-2xl p-4 space-y-3"
          style={{
            background: "#111111",
            border: "1px solid rgba(57,255,20,0.18)",
            boxShadow: "0 0 40px rgba(57,255,20,0.06)",
          }}
        >
          <div className="grid grid-cols-3 gap-1.5">
            {sections.map((section) => (
              <Fragment key={section.id}>
                {"href" in section ? (
                  <a
                    href={section.href}
                    style={{
                      background: "#000",
                      border: `2px solid ${LUMO}`,
                      color: LUMO,
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: "0.65rem",
                      cursor: "pointer",
                      textAlign: "center",
                      letterSpacing: "0.03em",
                      transition: "all 0.2s ease",
                      aspectRatio: "1 / 1",
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "4px",
                      minHeight: 0,
                      lineHeight: 1.25,
                      textDecoration: "none",
                    }}
                    className="touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.filter = "brightness(1.2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.filter = "brightness(1)"; }}
                    onMouseDown={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(0.98)"; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)"; }}
                  >
                    {section.title}
                  </a>
                ) : (
                  <InfoSquareBtn
                    title={section.title}
                    isOpen={openId === section.id}
                    onToggle={() => handleToggle(section.id)}
                  />
                )}

                {/* The open section's message renders as a full-width row right
                    after its button, so subsequent buttons fall below it. */}
                {!("href" in section) && openId === section.id && (
                  <div id={`content-${section.id}`} style={{ gridColumn: "1 / -1" }}>
                    <div
                      className="px-4 py-4 text-sm leading-relaxed space-y-3"
                      style={{
                        color: "#a0a0a0",
                        background: "rgba(57,255,20,0.04)",
                        borderRadius: 10,
                        border: "1px solid rgba(57,255,20,0.18)",
                      }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: LUMO }}>
                        {section.title}
                      </p>
                      {section.content}
                    </div>
                  </div>
                )}
              </Fragment>
            ))}
          </div>

          <button
            style={{
              background: `linear-gradient(135deg, ${LUMO}, ${LUMO_DARK})`,
              color: "#000",
              border: "none",
              borderRadius: 10,
              padding: "14px 0",
              width: "100%",
              fontWeight: 700,
              fontSize: "1rem",
              cursor: "pointer",
              minHeight: 48,
              letterSpacing: "0.02em",
              transition: "all 0.2s",
            }}
            className="touch-manipulation"
            onClick={handleLogin}
          >
            Log In
          </button>

          <div className="flex items-center justify-center gap-4 pt-6">
            <a
              href="https://www.facebook.com/AroundYou365"
              target="_blank"
              rel="noreferrer"
              aria-label="Around You on Facebook"
              className="touch-manipulation"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 999,
                color: LUMO,
                border: "1px solid rgba(57,255,20,0.35)",
                background: "rgba(57,255,20,0.06)",
                transition: "all 0.2s",
              }}
            >
              <Facebook size={22} />
            </a>
            <a
              href="https://www.linkedin.com/company/around-you-247/?viewAsMember=true"
              target="_blank"
              rel="noreferrer"
              aria-label="Around You on LinkedIn"
              className="touch-manipulation"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 999,
                color: LUMO,
                border: "1px solid rgba(57,255,20,0.35)",
                background: "rgba(57,255,20,0.06)",
                transition: "all 0.2s",
              }}
            >
              <Linkedin size={22} />
            </a>
          </div>
        </div>


      </div>
    </div>
  );
}
