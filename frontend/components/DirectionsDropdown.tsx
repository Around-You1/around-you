import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, MapPin, Loader2 } from "lucide-react";
import { getCurrentPosition, buildDirectionsUrl } from "../lib/geolocation";
import { useToast } from "@/components/ui/use-toast";

const FALLBACK = "The company has opted not to make this information visible.";

interface DirectionsDropdownProps {
  latitude?: number | null;
  longitude?: number | null;
}

export default function DirectionsDropdown({ latitude, longitude }: DirectionsDropdownProps) {
  const [gettingDirections, setGettingDirections] = useState(false);
  const { toast } = useToast();

  const hasCoords = latitude != null && longitude != null && !isNaN(latitude) && !isNaN(longitude);

  const getDirections = async () => {
    if (!hasCoords) return;
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
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-purple-600 transition-colors w-full text-left min-h-[44px] touch-manipulation">
        <ChevronDown className="h-4 w-4" />
        Directions
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pt-2">
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
            Get Directions
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground italic">{FALLBACK}</span>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
