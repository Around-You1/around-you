"use client";

import { useParams } from "next/navigation";
import { EstateAgentView } from "@/components/EstatePublic";

export default function Page() {
  const params = useParams<{ code: string }>();
  return <EstateAgentView code={params.code} />;
}
