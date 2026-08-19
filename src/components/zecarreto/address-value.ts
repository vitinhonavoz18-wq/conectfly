/**
 * O formato de um endereço nas telas do pedido.
 * Fica em arquivo próprio porque é usado por várias telas — e assim o
 * recarregamento automático do editor continua funcionando.
 */

export interface AddressValue {
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  postal_code: string;
  reference: string;
  lat: number | null;
  lng: number | null;
  contact_name: string;
  contact_phone: string;
  instructions: string;
  floor_number: number | null;
  has_elevator: boolean | null;
}

export const EMPTY_ADDRESS: AddressValue = {
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  postal_code: "",
  reference: "",
  lat: null,
  lng: null,
  contact_name: "",
  contact_phone: "",
  instructions: "",
  floor_number: null,
  has_elevator: null,
};
