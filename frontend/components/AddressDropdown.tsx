import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const FALLBACK = "The company has opted not to make this information visible.";

interface AddressDropdownProps {
  address?: string;
  area?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

export default function AddressDropdown({
  address,
  area,
  province,
  postalCode,
  country,
}: AddressDropdownProps) {
  const hasAny = address || area || province || postalCode || country;

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-purple-600 transition-colors w-full text-left min-h-[44px] touch-manipulation">
        <ChevronDown className="h-4 w-4" />
        Address
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pt-2 text-sm text-muted-foreground space-y-0.5">
        {hasAny ? (
          <>
            {address && <p>{address}</p>}
            {area && <p>{area}</p>}
            {province && <p>{province}</p>}
            {postalCode && <p>{postalCode}</p>}
            {country && <p>{country}</p>}
          </>
        ) : (
          <span className="italic">{FALLBACK}</span>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
