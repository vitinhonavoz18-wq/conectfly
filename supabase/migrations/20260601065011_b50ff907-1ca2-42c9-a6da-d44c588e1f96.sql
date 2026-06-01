-- Create orders table
CREATE TABLE public.orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_address TEXT,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT NOT NULL, -- 'pix', 'money', 'card'
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed'
    status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'preparing', 'delivering', 'completed', 'cancelled'
    is_test_order BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order items table
CREATE TABLE public.order_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID, -- Optional as it might be a combo or custom item
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    options Json, -- Store selected sizes, flavors, etc.
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexing for performance
CREATE INDEX idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Policies for orders
CREATE POLICY "Owners can view their own restaurant orders"
ON public.orders FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.restaurants r
        WHERE r.id = orders.restaurant_id
        AND (r.owner_id = auth.uid() OR (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin')
    )
);

-- Policies for order_items
CREATE POLICY "Owners can view their own restaurant order items"
ON public.order_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.restaurants r ON r.id = o.restaurant_id
        WHERE o.id = order_items.order_id
        AND (r.owner_id = auth.uid() OR (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin')
    )
);

-- Trigger for updated_at
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
