import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Check, Loader2, Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { ZcShell } from "@/components/zecarreto/ZcShell";
import { ZcChecklist, ZcRejectionNote, ZcStatusBadge } from "@/components/zecarreto/ZcStatus";
import { ZcUpload } from "@/components/zecarreto/ZcUpload";
import { useZcSession } from "@/components/zecarreto/useZcSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zcApi, zcErrorMessage } from "@/lib/zecarreto/client";

export const Route = createFileRoute("/zecarreto/motorista/veiculos")({ component: VeiculosPage });

interface Vehicle {
  id: string;
  category_id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  model_year: number | null;
  capacity_kg: number | null;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  photos: string[];
  documents: { id: string; type: string; status: string }[];
  checklist: { steps: { key: string; label: string; done: boolean }[]; percent: number };
}

interface Category {
  id: string;
  name: string;
  examples: string | null;
}

const EMPTY = {
  category_id: "",
  plate: "",
  brand: "",
  model: "",
  model_year: "",
  capacity_kg: "",
  notes: "",
};

/**
 * "Meus veículos" — o motorista pode ter quantos quiser (a Saveiro do dia
 * a dia e o caminhão do fim de semana). Cada um é aprovado separadamente.
 */
function VeiculosPage() {
  const { session, loading } = useZcSession({ required: true });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [list, catalog] = await Promise.all([
      zcApi<Vehicle[]>("/drivers/me/vehicles"),
      zcApi<{ categories: Category[] }>("/catalog"),
    ]);
    setVehicles(list);
    setCategories(catalog.categories);
    if (!form.category_id && catalog.categories[0]) {
      setForm((current) => ({ ...current, category_id: catalog.categories[0].id }));
    }
  }

  useEffect(() => {
    if (!session) return;
    load().catch((error) => toast.error(zcErrorMessage(error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function criar(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await zcApi("/drivers/me/vehicles", {
        method: "POST",
        body: {
          ...form,
          model_year: form.model_year ? Number(form.model_year) : undefined,
          capacity_kg: form.capacity_kg ? Number(form.capacity_kg) : undefined,
          notes: form.notes || undefined,
        },
      });
      setForm({ ...EMPTY, category_id: categories[0]?.id ?? "" });
      setShowForm(false);
      await load();
      toast.success("Veículo cadastrado. Envie as fotos e o documento.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function usarVeiculo(id: string) {
    try {
      await zcApi(`/drivers/me/vehicles/${id}`, { method: "POST", body: {} });
      await load();
      toast.success("Veículo marcado como em uso.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    }
  }

  async function inativar(id: string) {
    try {
      await zcApi(`/drivers/me/vehicles/${id}`, { method: "DELETE" });
      await load();
      toast.success("Veículo inativado.");
    } catch (error) {
      toast.error(zcErrorMessage(error));
    }
  }

  async function adicionarFoto(vehicle: Vehicle, path: string) {
    const photos = [...(vehicle.photos ?? []), path];
    await zcApi(`/drivers/me/vehicles/${vehicle.id}`, { method: "PATCH", body: { photos } });
    await load();
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
      title="Meus veículos"
      subtitle="Cada veículo é analisado separadamente. Você só recebe carretos da categoria de um veículo aprovado."
      back={{ to: "/zecarreto/motorista", label: "Área do carreteiro" }}
      action={
        <Button size="sm" onClick={() => setShowForm((value) => !value)}>
          <Plus className="mr-1 h-4 w-4" />
          Novo
        </Button>
      }
    >
      {showForm && (
        <form
          onSubmit={criar}
          className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4"
        >
          <p className="font-semibold">Cadastrar veículo</p>

          <div className="space-y-1.5">
            <Label htmlFor="category_id">Categoria</Label>
            <select
              id="category_id"
              value={form.category_id}
              onChange={(event) => setForm({ ...form, category_id: event.target.value })}
              className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.examples ? ` — ${category.examples}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plate">Placa</Label>
              <Input
                id="plate"
                value={form.plate}
                onChange={(event) => setForm({ ...form, plate: event.target.value.toUpperCase() })}
                placeholder="ABC1D23"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model_year">Ano</Label>
              <Input
                id="model_year"
                value={form.model_year}
                onChange={(event) => setForm({ ...form, model_year: event.target.value })}
                inputMode="numeric"
                placeholder="2020"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                value={form.brand}
                onChange={(event) => setForm({ ...form, brand: event.target.value })}
                placeholder="Fiat"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Modelo</Label>
              <Input
                id="model"
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
                placeholder="Fiorino"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="capacity_kg">Capacidade de carga (kg)</Label>
              <Input
                id="capacity_kg"
                value={form.capacity_kg}
                onChange={(event) => setForm({ ...form, capacity_kg: event.target.value })}
                inputMode="numeric"
                placeholder="650"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Tem lona, baú, carrinho..."
              />
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cadastrar
          </Button>
        </form>
      )}

      {vehicles.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center">
          <Truck className="mx-auto h-10 w-10 text-neutral-300" />
          <p className="mt-3 text-sm text-neutral-600">
            Nenhum veículo cadastrado. Você precisa de pelo menos um aprovado para ficar online.
          </p>
          <Button className="mt-4" onClick={() => setShowForm(true)}>
            Cadastrar meu veículo
          </Button>
        </div>
      )}

      {vehicles.map((vehicle) => (
        <div
          key={vehicle.id}
          className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
        >
          <div className="flex items-start gap-3">
            <Truck className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Veículo"}{" "}
                <span className="font-mono text-sm text-neutral-500">{vehicle.plate}</span>
              </p>
              <p className="text-sm text-neutral-600">
                {vehicle.model_year ? `${vehicle.model_year} · ` : ""}
                {vehicle.capacity_kg ? `${vehicle.capacity_kg} kg` : "capacidade não informada"}
              </p>
            </div>
            <ZcStatusBadge status={vehicle.status} kind="vehicle" />
          </div>

          <ZcRejectionNote reason={vehicle.rejection_reason} />

          <ZcChecklist steps={vehicle.checklist.steps} />

          <ZcUpload
            label={`Fotos do veículo (${vehicle.photos?.length ?? 0} enviada(s))`}
            hint="Frente, lateral e a área de carga."
            bucket="zc-avatars"
            purpose={`veiculo/${vehicle.id}`}
            accept="image/jpeg,image/png,image/webp,image/heic"
            done={(vehicle.photos?.length ?? 0) >= 2}
            onUploaded={async (result) => adicionarFoto(vehicle, result.publicUrl ?? result.path)}
          />

          <ZcUpload
            label="Documento do veículo (CRLV)"
            bucket="zc-documents"
            purpose={`crlv/${vehicle.id}`}
            done={vehicle.documents?.some((doc) => doc.type === "crlv")}
            onUploaded={async (result) => {
              await zcApi("/drivers/me/documents", {
                method: "POST",
                body: {
                  owner_kind: "vehicle",
                  vehicle_id: vehicle.id,
                  type: "crlv",
                  storage_path: result.path,
                },
              });
              await load();
            }}
          />

          <div className="flex flex-wrap gap-2">
            {vehicle.status === "approved" && (
              <Button variant="outline" size="sm" onClick={() => usarVeiculo(vehicle.id)}>
                <Check className="mr-1 h-4 w-4" />
                Usar este veículo
              </Button>
            )}
            {vehicle.status !== "inactive" && (
              <Button variant="ghost" size="sm" onClick={() => inativar(vehicle.id)}>
                <Trash2 className="mr-1 h-4 w-4" />
                Inativar
              </Button>
            )}
          </div>
        </div>
      ))}
    </ZcShell>
  );
}
