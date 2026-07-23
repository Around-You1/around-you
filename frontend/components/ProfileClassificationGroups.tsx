import { GUEST_TYPE_OPTIONS, ACCESS_LEVEL_OPTIONS } from "./OfficialUseSection";

interface ProfileClassificationGroupsProps {
  guestType?: string | null;
  accessLevel?: string | null;
}

export default function ProfileClassificationGroups({ guestType, accessLevel }: ProfileClassificationGroupsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Guest Type</p>
        <div className="flex flex-wrap gap-2">
          {GUEST_TYPE_OPTIONS.map((opt) => (
            <span
              key={opt}
              className={`text-xs px-2 py-0.5 rounded border ${
                guestType === opt
                  ? "bg-amber-100 border-amber-400 text-amber-800 font-semibold dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-300"
                  : "bg-muted/40 border-border text-muted-foreground"
              }`}
            >
              {opt}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Access Level</p>
        <div className="flex flex-wrap gap-2">
          {ACCESS_LEVEL_OPTIONS.map((opt) => (
            <span
              key={opt}
              className={`text-xs px-2 py-0.5 rounded border ${
                accessLevel === opt
                  ? "bg-amber-100 border-amber-400 text-amber-800 font-semibold dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-300"
                  : "bg-muted/40 border-border text-muted-foreground"
              }`}
            >
              {opt}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
