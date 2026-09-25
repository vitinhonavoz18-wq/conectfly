import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { SettingsManager } from "@/components/admin/settings-manager";

export const metadata: Metadata = {
  title: "Configurações",
  robots: { index: false, follow: false },
};

export default function AdminSettingsPage() {
  return (
    <AdminShell
      title="Configurações"
      description="WhatsApp, redes sociais, endereço e regras comerciais da loja."
    >
      <SettingsManager />
    </AdminShell>
  );
}
