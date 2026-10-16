import { GUEST_TYPE_OPTIONS, ACCESS_LEVEL_OPTIONS } from "./OfficialUseSection";

interface ProfileClassificationGroupsProps {
  guestType?: string | null;
  accessLevel?: string | null;
}

export default function ProfileClassificationGroups(_props: ProfileClassificationGroupsProps) {
  // Guest Type / Access Level were removed in the flat R300 model (Oct 2026).
  return null;
}
