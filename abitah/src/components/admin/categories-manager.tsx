"use client";

import { useCallback, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { adminListCategories } from "@/services/admin";
import { useAsyncData } from "@/hooks/use-async-data";
import { slugify } from "@/lib/utils";
import type { Category } from "@/types/catalog";

export function CategoriesManager() {
  const supabase = getSupabaseBrowserClient();
  const { notify } = useToast();
  const [name, setName] = useState("");
  const [group, setGroup] = useState<"roupas" | "acessorios">("roupas");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const loader = useCallback(
    () => (supabase ? adminListCategories(supabase) : Promise.resolve([])),
    [supabase],
  );
  const { data: categories, refresh: load } = useAsyncData<Category[]>(loader, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !name.trim()) return;
    setSaving(true);

    const { error } = await supabase.from("categories").insert({
      name: name.trim(),
      slug: slugify(name),
      group_key: group,
      description: description.trim() || null,
      position: (categories?.length ?? 0) + 1,
      active: true,
    });

    setSaving(false);
    if (error) {
      notify("Não foi possível criar a categoria. O slug já pode existir.", "error");
      return;
    }
    notify("Categoria criada.");
    setName("");
    setDescription("");
    void load();
  }

  async function toggleActive(category: Category) {
    if (!supabase) return;
    await supabase.from("categories").update({ active: !category.active }).eq("id", category.id);
    void load();
  }

  async function remove(category: Category) {
    if (!supabase) return;
    if (!window.confirm(`Excluir a categoria "${category.name}"?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", category.id);
    if (error) {
      notify("Existem produtos usando esta categoria. Mova-os antes de excluir.", "error");
      return;
    }
    notify("Categoria excluída.", "info");
    void load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="rounded-card border border-ink-700 bg-ink-900 p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
          Nova categoria
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-6">
          <Field label="Nome" htmlFor="cat-name" required className="sm:col-span-2">
            <Input id="cat-name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Linha" htmlFor="cat-group" required className="sm:col-span-2">
            <Select
              id="cat-group"
              value={group}
              onChange={(event) => setGroup(event.target.value as "roupas" | "acessorios")}
            >
              <option value="roupas">Roupas</option>
              <option value="acessorios">Acessórios</option>
            </Select>
          </Field>
          <Field label="Descrição" htmlFor="cat-desc" className="sm:col-span-2">
            <Input
              id="cat-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" className="mt-5" disabled={saving}>
          <Plus className="h-4 w-4" aria-hidden />
          {saving ? "Criando..." : "Criar categoria"}
        </Button>
      </form>

      {categories === null ? (
        <div className="h-48 animate-pulse rounded-card bg-ink-900" />
      ) : categories.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-600 bg-ink-900 px-6 py-12 text-center text-sm text-smoke-300">
          Nenhuma categoria cadastrada.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-700">
          <table className="w-full min-w-150 text-left text-sm">
            <thead className="bg-ink-850 text-[11px] uppercase tracking-wider text-smoke-300">
              <tr>
                <th scope="col" className="px-4 py-3">Nome</th>
                <th scope="col" className="px-4 py-3">Slug</th>
                <th scope="col" className="px-4 py-3">Linha</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 bg-ink-900 text-smoke-300">
              {categories.map((category) => (
                <tr key={category.id}>
                  <td className="px-4 py-3 font-semibold text-white">{category.name}</td>
                  <td className="px-4 py-3 text-xs">{category.slug}</td>
                  <td className="px-4 py-3 capitalize">{category.group}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(category)}
                      className={category.active ? "text-neon-400" : "text-smoke-400"}
                    >
                      {category.active ? "Ativa" : "Inativa"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(category)}
                      aria-label={`Excluir ${category.name}`}
                      className="rounded p-2 text-smoke-400 transition-colors hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
