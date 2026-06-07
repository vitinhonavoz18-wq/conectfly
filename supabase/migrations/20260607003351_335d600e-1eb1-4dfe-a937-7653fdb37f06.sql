-- Update restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS pickup_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS table_enabled BOOLEAN DEFAULT false;

-- Update orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'delivery',
ADD COLUMN IF NOT EXISTS service_mode TEXT DEFAULT 'delivery',
ADD COLUMN IF NOT EXISTS table_number TEXT,
ADD COLUMN IF NOT EXISTS ticket_number TEXT;

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON public.orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_ticket_number ON public.orders(ticket_number);