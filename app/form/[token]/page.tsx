import { redirect } from "next/navigation";

export default function LegacyTokenFormPage() {
  redirect("/login?next=/portal/formulario");
}
