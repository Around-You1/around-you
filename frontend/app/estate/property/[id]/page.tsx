"use client";

import { useParams } from "next/navigation";
import { EstatePropertyView } from "@/components/EstatePublic";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <EstatePropertyView id={Number(params.id)} />;
}
