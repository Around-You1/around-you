import { useEffect, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Globe, Instagram, Twitter, Youtube, Music, Mail, Phone, ExternalLink } from "lucide-react";
import backend from "~backend/client";
import type { ProfileSettings } from "~backend/storage/get_profile_settings";

const FALLBACK = "The company has opted not to make this information visible.";

interface Props {
  triggerClass: string;
  contentClass: string;
}

export default function BookingsSocialsDropdowns({ triggerClass, contentClass }: Props) {
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const fallbackSpan = <span className="text-sm text-muted-foreground italic">{FALLBACK}</span>;

  useEffect(() => {
    backend.storage.getProfileSettings().then(setSettings).catch(() => {});
  }, []);

  if (!settings) return null;

  const hasBookings = settings.bookingsEmail || settings.bookingsContactNumber;
  const hasSocials =
    settings.socialsWebsite ||
    settings.socialsInstagram ||
    settings.socialsTwitter ||
    settings.socialsYoutube ||
    settings.socialsTiktok;

  const socialLinks: Array<{ key: keyof ProfileSettings; label: string; icon: React.ReactNode }> = [
    { key: "socialsWebsite", label: "Website", icon: <Globe className="h-3 w-3 flex-shrink-0" /> },
    { key: "socialsInstagram", label: "Instagram", icon: <Instagram className="h-3 w-3 flex-shrink-0" /> },
    { key: "socialsTwitter", label: "X (Twitter)", icon: <Twitter className="h-3 w-3 flex-shrink-0" /> },
    { key: "socialsYoutube", label: "YouTube", icon: <Youtube className="h-3 w-3 flex-shrink-0" /> },
    { key: "socialsTiktok", label: "TikTok", icon: <Music className="h-3 w-3 flex-shrink-0" /> },
  ];

  return (
    <>
      <Collapsible>
        <CollapsibleTrigger className={triggerClass}>
          <ChevronDown className="h-4 w-4" />
          Bookings
        </CollapsibleTrigger>
        <CollapsibleContent className={`${contentClass} text-sm space-y-2`}>
          {hasBookings ? (
            <>
              {settings.bookingsEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <a
                    href={`mailto:${settings.bookingsEmail}`}
                    className="text-purple-600 hover:underline break-all"
                  >
                    {settings.bookingsEmail}
                  </a>
                </div>
              )}
              {settings.bookingsContactNumber && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <a
                    href={`tel:${settings.bookingsContactNumber}`}
                    className="text-purple-600 hover:underline"
                  >
                    {settings.bookingsContactNumber}
                  </a>
                </div>
              )}
            </>
          ) : (
            fallbackSpan
          )}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className={triggerClass}>
          <ChevronDown className="h-4 w-4" />
          Socials
        </CollapsibleTrigger>
        <CollapsibleContent className={`${contentClass} text-sm space-y-2`}>
          {hasSocials ? (
            <>
              {socialLinks.map(({ key, label, icon }) =>
                settings[key] ? (
                  <div key={key} className="flex items-center gap-2">
                    {icon}
                    <a
                      href={settings[key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:underline flex items-center gap-1 break-all"
                    >
                      {label}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </div>
                ) : null
              )}
            </>
          ) : (
            fallbackSpan
          )}
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
