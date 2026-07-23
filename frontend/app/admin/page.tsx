import { redirect } from "next/navigation";

// Legacy path the untouched components navigate to.
export default function Page() {
  redirect("/dashboard/admin");
}
