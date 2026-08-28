import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";

export interface OfficialUseData {
  officialHoldingCompany: string;
  officialContactName: string;
  officialContactNumber: string;
  officialEmail: string;
  officialRepCode: string;
  officialRepName: string;
  companyRegNumber: string;
  companyVatNumber: string;
  guestType: string;
  accessLevel: string;
  charity?: string[];
}

const CHARITY_ROW1 = ["Adults", "Children", "Animals"] as const;
const CHARITY_ROW2 = ["Health", "Homes", "Food"] as const;

interface OfficialUseSectionProps {
  data: OfficialUseData;
  onChange: (data: OfficialUseData) => void;
  // Guest Type and Access Level are Tier fields that only apply to
  // Restaurant / Service / Attraction. Accommodation passes showTierFields=false
  // to hide them (the underlying columns still exist and are simply left blank).
  // Defaults to true so the other three forms keep showing them unchanged.
  showTierFields?: boolean;
}

const GUEST_TYPE_OPTIONS = ["Guest Only", "Local", "Both"] as const;
const ACCESS_LEVEL_OPTIONS = ["Tier 1", "Tier 2"] as const;

function RadioGroup({
  label,
  options,
  value,
  onChange,
  name,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (val: string) => void;
  name: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="accent-amber-600"
            />
            <span className="text-sm">{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function OfficialUseSection({ data, onChange, showTierFields = true }: OfficialUseSectionProps) {
  const set = (field: keyof OfficialUseData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...data, [field]: e.target.value });

  // Charity is a two-level, single-select pick: one group (Adults/Children/
  // Animals) and — only once a group is chosen — one focus (Health/Homes/Food).
  // Stored as [group, sub] so the analytics matrix can pair them.
  const charity = data.charity || [];
  const charityGroup = charity.find((c) => (CHARITY_ROW1 as readonly string[]).includes(c)) || "";
  const charitySub = charity.find((c) => (CHARITY_ROW2 as readonly string[]).includes(c)) || "";

  const selectCharityGroup = (g: string) => {
    const next = charityGroup === g ? "" : g; // click again to clear
    onChange({ ...data, charity: [...(next ? [next] : []), ...(next && charitySub ? [charitySub] : [])] });
  };
  const selectCharitySub = (s: string) => {
    const next = charitySub === s ? "" : s;
    onChange({ ...data, charity: [...(charityGroup ? [charityGroup] : []), ...(next ? [next] : [])] });
  };

  const CharityRow = ({ options, selected, onSelect }: { options: readonly string[]; selected: string; onSelect: (c: string) => void }) => (
    <div className="flex flex-wrap gap-4">
      {options.map((c) => (
        <label key={c} className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" checked={selected === c} onChange={() => onSelect(c)} className="accent-amber-600" />
          {c}
        </label>
      ))}
    </div>
  );

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-400 text-base">
          <Shield className="h-4 w-4" />
          Official Use
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showTierFields && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RadioGroup
              label="Guest Type"
              name="officialGuestType"
              options={GUEST_TYPE_OPTIONS}
              value={data.guestType}
              onChange={(val) =>
                // Choosing "Both" audiences auto-selects the top tier (Tier 2),
                // matching the Rep Onboarding app.
                onChange({ ...data, guestType: val, ...(val === "Both" ? { accessLevel: "Tier 2" } : {}) })
              }
            />
            <RadioGroup
              label="Access Level"
              name="officialAccessLevel"
              options={ACCESS_LEVEL_OPTIONS}
              value={data.accessLevel}
              onChange={(val) => onChange({ ...data, accessLevel: val })}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="officialHoldingCompany">Holding Company</Label>
            <Input
              id="officialHoldingCompany"
              value={data.officialHoldingCompany}
              onChange={set("officialHoldingCompany")}
              placeholder="Holding company name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="officialContactName">Person Responsible</Label>
            <Input
              id="officialContactName"
              value={data.officialContactName}
              onChange={set("officialContactName")}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="officialContactNumber">Person Responsible Number</Label>
            <Input
              id="officialContactNumber"
              value={data.officialContactNumber}
              onChange={set("officialContactNumber")}
              placeholder="+27 000 000 0000"
              type="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="officialEmail">Email</Label>
            <Input
              id="officialEmail"
              value={data.officialEmail}
              onChange={set("officialEmail")}
              placeholder="contact@example.com"
              type="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyRegNumber">Company Registration Number</Label>
            <Input
              id="companyRegNumber"
              value={data.companyRegNumber}
              onChange={set("companyRegNumber")}
              placeholder="Company registration number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyVatNumber">Company VAT Number</Label>
            <Input
              id="companyVatNumber"
              value={data.companyVatNumber}
              onChange={set("companyVatNumber")}
              placeholder="Company VAT number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="officialRepCode">Rep Code</Label>
            <Input
              id="officialRepCode"
              value={data.officialRepCode}
              onChange={set("officialRepCode")}
              placeholder="Rep code"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="officialRepName">Rep Name</Label>
            <Input
              id="officialRepName"
              value={data.officialRepName}
              onChange={set("officialRepName")}
              placeholder="Rep's full name"
            />
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
          <Label className="text-sm font-semibold text-amber-800 dark:text-amber-400">Charity</Label>
          <CharityRow options={CHARITY_ROW1} selected={charityGroup} onSelect={selectCharityGroup} />
          {charityGroup && <CharityRow options={CHARITY_ROW2} selected={charitySub} onSelect={selectCharitySub} />}
        </div>
      </CardContent>
    </Card>
  );
}

export { GUEST_TYPE_OPTIONS, ACCESS_LEVEL_OPTIONS };
