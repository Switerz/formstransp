import { redirect } from "next/navigation";
import { requireCarrierUser } from "@/lib/auth";

export default async function PortalPage() {
  await requireCarrierUser("/portal");

  redirect("/portal/minha-base");
}
