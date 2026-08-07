export type CartItem = {
  /** productId + tamanho + cor — identifica a linha do carrinho. */
  key: string;
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  size: string;
  color: string;
  colorHex: string;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  maxQuantity: number;
};

export type AppliedCoupon = {
  code: string;
  discount: number;
  description: string;
};

export type ShippingOptionId = "standard" | "express" | "pickup";
