"use client";

import { useParams } from "next/navigation";
import { EstateAgencyView } from "@/components/EstatePublic";

export default function Page() {
  const params = useParams<{ code: string }>();
  return <EstateAgencyView code={params.code} />;
}
