import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "How Around You Works — for Guests & Locals",
  description:
    "How to use Around You: sign in as a Holiday Guest or a Local, explore nearby restaurants, services and attractions, redeem discounts, book tables, and rate your visits.",
};

const LUMO = "#39FF14";

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="flex-shrink-0 flex items-center justify-center rounded-full text-black font-bold"
        style={{ background: LUMO, width: 26, height: 26, fontSize: "0.8rem" }}
      >
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen px-5 py-10" style={{ background: "#0a0a0a", color: "#E6F7E6" }}>
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/around-you-logo.png" alt="Around You" style={{ maxHeight: 72 }} className="mx-auto" />
          <h1 className="text-3xl font-bold" style={{ color: LUMO }}>
            How Around You Works
          </h1>
          <p className="text-sm text-[#A6B0A6] max-w-xl mx-auto">
            Around You gives you instant access to everything worth knowing near where you&apos;re
            staying — verified accommodation info, trusted local restaurants, services and
            attractions, exclusive discounts, and one-tap directions. Here&apos;s how to get started.
          </p>
        </div>

        <section
          className="rounded-2xl p-6 space-y-4"
          style={{ background: "#111", border: "1px solid rgba(57,255,20,0.18)" }}
        >
          <h2 className="text-xl font-semibold" style={{ color: LUMO }}>For Holiday Guests</h2>
          <p className="text-sm text-[#A6B0A6]">
            Your accommodation gives you an Access Code or a QR code when you arrive.
          </p>
          <ol className="space-y-3 text-sm">
            <Step n={1}>Open Around You and tap <strong>Guest</strong> on the sign-in screen.</Step>
            <Step n={2}>
              Enter your 12-character <strong>Access Code</strong> (or scan the QR code — it fills the
              code in for you), then tap <strong>Sign In</strong>. You can also sign in with your
              accommodation&apos;s name, address, province and postal code.
            </Step>
            <Step n={3}>
              You&apos;ll land on your accommodation&apos;s page with everything you need — Wi-Fi,
              check-in and check-out details, house rules, amenities, emergency contacts and directions.
            </Step>
            <Step n={4}>
              Explore what&apos;s Around You: browse restaurants, services and attractions near your
              stay using the radius slider (from 10 km up to 150 km). Search by cuisine, category or keyword.
            </Step>
            <Step n={5}>
              Save money: when a place offers a discount, tap <strong>Redeem discount</strong> to get
              your QR code — show it to the venue to redeem. You can also book a restaurant table right in the app.
            </Step>
            <Step n={6}>After you&apos;ve visited, leave a star rating to help other guests.</Step>
          </ol>
          <p className="text-sm" style={{ color: LUMO }}>
            What to do next: grab the code or QR your accommodation gave you, sign in as a Guest, and start exploring.
          </p>
        </section>

        <section
          className="rounded-2xl p-6 space-y-4"
          style={{ background: "#111", border: "1px solid rgba(57,255,20,0.18)" }}
        >
          <h2 className="text-xl font-semibold" style={{ color: LUMO }}>For Locals</h2>
          <p className="text-sm text-[#A6B0A6]">Live in the area? Around You is for you too.</p>
          <ol className="space-y-3 text-sm">
            <Step n={1}>Tap <strong>Locals</strong> on the sign-in screen.</Step>
            <Step n={2}>
              Sign in with your email, province and postal code. The first time, we&apos;ll email you a
              one-time code (OTP) to verify it&apos;s you.
            </Step>
            <Step n={3}>
              After that, you can sign in without the code — up to 5 times a month (or 10 if you&apos;re
              awarded <strong>Super Local</strong> status).
            </Step>
            <Step n={4}>
              Browse restaurants, services and attractions near you with the radius slider (up to 50 km),
              search, and grab exclusive discounts the same way — tap <strong>Redeem discount</strong> and
              show your QR to the venue.
            </Step>
            <Step n={5}>Rate the places you visit to help your community.</Step>
          </ol>
          <p className="text-sm" style={{ color: LUMO }}>
            What to do next: tap Locals, sign in with your email, and discover what&apos;s Around You.
          </p>
        </section>

        <div className="text-center space-y-2 pt-2">
          <p className="text-sm text-[#A6B0A6]">
            Need help? Email{" "}
            <a href="mailto:support@aroundyou.co.za" style={{ color: LUMO }} className="hover:underline">
              support@aroundyou.co.za
            </a>
            .
          </p>
          <a
            href="/"
            className="inline-block rounded-lg px-5 py-2 font-semibold text-black"
            style={{ background: LUMO }}
          >
            Go to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
