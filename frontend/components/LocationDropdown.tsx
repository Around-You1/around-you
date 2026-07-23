import { useState } from "react";
import { MapPin, ChevronDown, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { getCurrentPosition, buildDirectionsUrl } from "../lib/geolocation";
import { useToast } from "@/components/ui/use-toast";

const FALLBACK_MESSAGE = "The Company has not opted to display this information. Please contact the property for location details.";

interface LocationDropdownProps {
  address: string;
  province?: string;
  postalCode?: string;
  country?: string;
  area?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export default function LocationDropdown({
  address,
  province,
  postalCode,
  country,
  area,
  latitude,
  longitude,
}: LocationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [gettingDirections, setGettingDirections] = useState(false);
  const { toast } = useToast();

  const hasCoords = latitude != null && longitude != null;

  const getDirections = async () => {
    if (!hasCoords || isNaN(latitude!) || isNaN(longitude!)) {
      toast({
        title: "Error",
        description: "Invalid coordinates for this location",
        variant: "destructive",
      });
      return;
    }

    setGettingDirections(true);
    try {
      const userPosition = await getCurrentPosition();
      const url = buildDirectionsUrl(
        { latitude: latitude!, longitude: longitude! },
        { latitude: userPosition.latitude, longitude: userPosition.longitude }
      );
      window.open(url, "_blank");
    } catch {
      const url = buildDirectionsUrl({ latitude: latitude!, longitude: longitude! });
      window.open(url, "_blank");
    } finally {
      setGettingDirections(false);
    }
  };

  return (
    <div className="border-t border-border/40 pt-2 mt-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-purple-600 transition-colors w-full text-left min-h-[44px] touch-manipulation">
          <MapPin className="h-4 w-4 flex-shrink-0 text-purple-500" />
          <span>Location Details</span>
          <ChevronDown
            className={`h-4 w-4 ml-auto flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6 pt-2 space-y-3">
          <div className="text-sm text-muted-foreground space-y-0.5">
            <p>{address}</p>
            {area && <p>{area}</p>}
            {province && <p>{province}</p>}
            {postalCode && <p>{postalCode}</p>}
            {country && <p>{country}</p>}
          </div>
          {hasCoords ? (
            <Button
              className="bg-[#AEECE4] hover:bg-[#AEECE4]/90 text-black min-h-[44px] px-4 touch-manipulation flex items-center gap-2"
              onClick={getDirections}
              disabled={gettingDirections}
            >
              {gettingDirections ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <MapPin className="h-5 w-5" />
              )}
              Directions
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground italic">{FALLBACK_MESSAGE}</p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
