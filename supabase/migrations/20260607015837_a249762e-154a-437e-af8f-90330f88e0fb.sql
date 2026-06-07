-- 1. Tabela de Mesas
CREATE TABLE public.restaurant_tables (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    table_name TEXT,
    public_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(restaurant_id, table_number),
    UNIQUE(public_token)
);

-- 2. Tabela de Sessões de Mesa (Comandas)
CREATE TABLE public.table_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Tabela de Vínculo de Pedidos com Sessões
CREATE TABLE public.table_session_orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    table_session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT SELECT ON public.restaurant_tables TO anon;
GRANT ALL ON public.restaurant_tables TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_sessions TO authenticated;
GRANT SELECT ON public.table_sessions TO anon;
GRANT ALL ON public.table_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_session_orders TO authenticated;
GRANT SELECT ON public.table_session_orders TO anon;
GRANT ALL ON public.table_session_orders TO service_role;

-- 5. RLS
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_session_orders ENABLE ROW LEVEL SECURITY;

-- Políticas para restaurant_tables
CREATE POLICY "Users can manage their own restaurant tables" ON public.restaurant_tables
    FOR ALL USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "Public can view active restaurant tables" ON public.restaurant_tables
    FOR SELECT USING (is_active = true);

-- Políticas para table_sessions
CREATE POLICY "Users can manage their own restaurant table sessions" ON public.table_sessions
    FOR ALL USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "Public can view open table sessions" ON public.table_sessions
    FOR SELECT USING (status = 'open');

-- Políticas para table_session_orders
CREATE POLICY "Users can manage their own restaurant table session orders" ON public.table_session_orders
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.table_sessions s
        JOIN public.restaurants r ON r.id = s.restaurant_id
        WHERE s.id = table_session_id AND r.owner_id = auth.uid()
    ));

CREATE POLICY "Public can insert table session orders" ON public.table_session_orders
    FOR INSERT WITH CHECK (true);

-- 6. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_restaurant_tables_updated_at BEFORE UPDATE ON public.restaurant_tables FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_table_sessions_updated_at BEFORE UPDATE ON public.table_sessions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
