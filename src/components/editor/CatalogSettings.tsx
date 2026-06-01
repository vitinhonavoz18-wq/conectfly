import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function CatalogSettings({ category, onUpdate }: { category: any; onUpdate: (p: any) => void }) {
  return (
    <div className="flex items-center gap-6 bg-white/5 p-3 rounded-xl border border-white/5">
      <div className="flex items-center gap-2">
        <Switch
          id={`show-public-${category.id}`}
          checked={category.show_on_public_site !== false}
          onCheckedChange={(v) => onUpdate({ show_on_public_site: v })}
        />
        <Label htmlFor={`show-public-${category.id}`} className="text-[10px] font-bold uppercase cursor-pointer">Site Público</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id={`show-direct-${category.id}`}
          checked={category.show_directly_in_menu !== false}
          onCheckedChange={(v) => onUpdate({ show_directly_in_menu: v })}
        />
        <Label htmlFor={`show-direct-${category.id}`} className="text-[10px] font-bold uppercase cursor-pointer">Menu Direto</Label>
      </div>
    </div>
  );
}
