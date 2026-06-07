-- 1. Adiciona colunas à tabela orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES public.restaurant_tables(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS table_token TEXT;

-- 2. Função para gerenciar sessões de mesa
CREATE OR REPLACE FUNCTION public.handle_table_order_session() 
RETURNS TRIGGER AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Só processa se for pedido de mesa
    IF NEW.order_type = 'table' AND NEW.table_id IS NOT NULL THEN
        
        -- Busca sessão aberta para esta mesa
        SELECT id INTO v_session_id 
        FROM public.table_sessions 
        WHERE table_id = NEW.table_id AND status = 'open'
        LIMIT 1;

        -- Se não existe sessão aberta, cria uma nova
        IF v_session_id IS NULL THEN
            INSERT INTO public.table_sessions (
                restaurant_id, 
                table_id, 
                table_number, 
                status, 
                total_amount,
                opened_at
            ) VALUES (
                NEW.restaurant_id,
                NEW.table_id,
                NEW.table_number,
                'open',
                NEW.total_amount,
                now()
            ) RETURNING id INTO v_session_id;
        ELSE
            -- Se já existe, atualiza o valor total
            UPDATE public.table_sessions 
            SET total_amount = total_amount + NEW.total_amount,
                updated_at = now()
            WHERE id = v_session_id;
        END IF;

        -- Vincula o pedido à sessão
        INSERT INTO public.table_session_orders (
            table_session_id,
            order_id
        ) VALUES (
            v_session_id,
            NEW.id
        );

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger na tabela orders
DROP TRIGGER IF EXISTS tr_handle_table_order_session ON public.orders;
CREATE TRIGGER tr_handle_table_order_session
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_table_order_session();
