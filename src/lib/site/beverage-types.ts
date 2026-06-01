export interface BeverageCatalogRow {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  active: boolean;
  sort_order: number;
}
