import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — Around You",
  description: "The terms governing use of the Around You platform.",
};

const LUMO = "#39FF14";

export default function TermsPage() {
  const effective = "31 August 2026";
  return (
    <div className="min-h-screen px-5 py-10" style={{ background: "#0a0a0a", color: "#E6F7E6" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold" style={{ color: LUMO }}>Terms of Use</h1>
          <p className="text-xs text-[#A6B0A6]">Effective {effective}</p>
        </div>

        <section className="space-y-2 text-sm text-[#c9d6c9] leading-relaxed">
          <p>These Terms of Use govern your access to and use of the Around You platform, website and apps (the &ldquo;Service&rdquo;), operated by Around You (Pty) Ltd (&ldquo;Around You&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By accessing or using the Service you agree to these terms. If you do not agree, please do not use the Service.</p>
        </section>

        <Section title="1. Who may use the Service">
          The Service is provided to guests, local users, partners (accommodations, restaurants, services, attractions, estate agents) and sales representatives. You must provide accurate information and are responsible for activity under your access code or account.
        </Section>

        <Section title="2. Accounts, access codes & security">
          Access codes, QR codes, rep codes and any login credentials are personal to you and must be kept confidential. You may not share, sell or transfer them. Notify us immediately of any suspected unauthorised use. We may suspend access where misuse or a security risk is suspected.
        </Section>

        <Section title="3. Acceptable use">
          You agree not to: misuse or disrupt the Service; attempt to gain unauthorised access to any account, system or data; scrape, harvest or bulk-copy content or contact details; upload unlawful, misleading or infringing content; or use the Service to send spam. Partner and listing content must be accurate and lawful.
        </Section>

        <Section title="4. Intellectual property">
          The Service, its content, design, branding, text, graphics and software are owned by or licensed to Around You and are protected by copyright and other laws. You may not copy, reproduce, republish, distribute or create derivative works from any part of the Service without our prior written permission. Partners retain rights in the content they submit but grant us a licence to display it within the Service.
        </Section>

        <Section title="5. Partners, reps & payments">
          Partner subscriptions, discounts, bookings, rep commissions, invoices and payouts are subject to the specific terms presented to you at sign-up (including the rep Responsibility &amp; Payment Terms for sales representatives). Fees and commission structures may change on reasonable notice.
        </Section>

        <Section title="6. Personal information (POPIA)">
          We process personal information in line with the Protection of Personal Information Act (POPIA) for the purposes of providing the Service, onboarding, communications, billing and payouts. See our Privacy Policy for details of what we collect, how it is used, and your rights.
        </Section>

        <Section title="7. Disclaimers & liability">
          The Service is provided &ldquo;as is&rdquo;. While we work to keep information accurate, we do not warrant that listings, discounts or third-party partner offerings are error-free or always available. To the extent permitted by law, Around You is not liable for indirect or consequential loss arising from use of the Service or from dealings with partners.
        </Section>

        <Section title="8. Changes to these terms">
          We may update these Terms from time to time. Material changes will be reflected by updating the effective date above and, where appropriate, by notice within the Service. Continued use after changes means you accept the updated terms.
        </Section>

        <Section title="9. Contact">
          Questions about these Terms can be sent to{" "}
          <a href="mailto:support@aroundyou.co.za" style={{ color: LUMO }} className="hover:underline">support@aroundyou.co.za</a>.
        </Section>

        <div className="pt-2">
          <a href="/" className="inline-block rounded-lg px-5 py-2 font-semibold text-black" style={{ background: LUMO }}>
            Back to Around You
          </a>
        </div>

        <p className="text-[11px] text-[#6b7280] pt-4">
          This is a general template and not legal advice. Please have it reviewed by a qualified South African attorney before relying on it.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-base font-semibold" style={{ color: LUMO }}>{title}</h2>
      <p className="text-sm text-[#c9d6c9] leading-relaxed">{children}</p>
    </section>
  );
}
