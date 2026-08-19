import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, MapPin, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ZcShell } from "@/components/zecarreto/ZcShell";
import { useZcSession } from "@/components/zecarreto/useZcSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zcApi, zcErrorMessage } from "@/lib/zecarreto/client";

export const Route = createFileRoute("/zecarreto/enderecos")({ component: EnderecosPage });

interface Address {
  id: string;
  label: string | null;
  street: string;
  number: string | null;
  district: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  is_default: boolean;
}

const EMPTY = {
  label: "",
  street: "",
  number: "",
  district: "",
  city: "",
  state: "",
  postal_code: "",
};

function EnderecosPage() {
  const { session, loading } = useZcSession({ required: true });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    setAddresses(await zcApi<Address[]>("/profile/addresses"));
  }

  useEffect(() => {
    if (!session) return;
    load().catch((error) => toast.error(zcErrorMessage(error)));
  }, [session]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await zcApi("/profile/addresses", {
        method: "POST",
        body: { ...form, is_default: addresses.length === 0 },
      });
      setForm(EMPTY);
      await load();
      toast.success("Endereço salvo.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(id: string) {
    try {
      await zcApi(`/profile/addresses/${id}`, { method: "PUT", body: { is_default: true } });
      await load();
    } catch (error) {
      toast.error(zcErrorMessage(error));
    }
  }

  async function remove(id: string) {
    try {
      await zcApi(`/profile/addresses/${id}`, { method: "DELETE" });
      await load();
      toast.success("Endereço removido da lista.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    }
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <ZcShell
      title="Meus endereços"
      subtitle="Salve os lugares de sempre e ganhe tempo ao pedir um carreto."
      back={{ to: "/zecarreto", label: "Início" }}
    >
      <div className="space-y-3">
        {addresses.length === 0 && (
          <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
            Nenhum endereço salvo ainda.
          </p>
        )}
        {addresses.map((address) => (
          <div
            key={address.id}
            className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4"
          >
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {address.label || "Endereço"}
                {address.is_default && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                    padrão
                  </span>
                )}
              </p>
              <p className="text-sm text-neutral-600">
                {address.street}
                {address.number ? `, ${address.number}` : ""}
                {address.district ? ` — ${address.district}` : ""}
              </p>
              <p className="text-sm text-neutral-500">
                {address.city}/{address.state}
                {address.postal_code ? ` · ${address.postal_code}` : ""}
              </p>
            </div>
            {!address.is_default && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDefault(address.id)}
                title="Tornar padrão"
              >
                <Star className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => remove(address.id)} title="Remover">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <p className="font-semibold">Adicionar endereço</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="label">Apelido</Label>
            <Input
              id="label"
              value={form.label}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
              placeholder="Casa, Depósito, Loja"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="postal_code">CEP</Label>
            <Input
              id="postal_code"
              value={form.postal_code}
              onChange={(event) => setForm({ ...form, postal_code: event.target.value })}
              placeholder="00000-000"
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="street">Rua</Label>
            <Input
              id="street"
              value={form.street}
              onChange={(event) => setForm({ ...form, street: event.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="number">Número</Label>
            <Input
              id="number"
              value={form.number}
              onChange={(event) => setForm({ ...form, number: event.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="district">Bairro</Label>
            <Input
              id="district"
              value={form.district}
              onChange={(event) => setForm({ ...form, district: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">UF</Label>
            <Input
              id="state"
              value={form.state}
              onChange={(event) => setForm({ ...form, state: event.target.value.toUpperCase() })}
              maxLength={2}
              placeholder="SP"
              required
            />
          </div>
        </div>

        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar endereço
        </Button>
      </form>
    </ZcShell>
  );
}
