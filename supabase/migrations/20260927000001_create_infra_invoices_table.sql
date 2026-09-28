-- Migration: Create infra_invoices table for itemized vendor infrastructure invoices
CREATE TABLE IF NOT EXISTS public.infra_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    amount_usd NUMERIC NOT NULL DEFAULT 0,
    amount_inr NUMERIC NOT NULL DEFAULT 0,
    billing_period_start DATE,
    billing_period_end DATE,
    invoice_number TEXT,
    notes TEXT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance and sorting indexes
CREATE INDEX IF NOT EXISTS idx_infra_invoices_paid_at ON public.infra_invoices(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_infra_invoices_provider ON public.infra_invoices(provider);

-- Row Level Security (RLS)
ALTER TABLE public.infra_invoices ENABLE ROW LEVEL SECURITY;

-- Allow authenticated admins full access
DROP POLICY IF EXISTS "Allow authenticated admins full access to infra_invoices" ON public.infra_invoices;
CREATE POLICY "Allow authenticated admins full access to infra_invoices" ON public.infra_invoices
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()::text AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()::text AND profiles.role = 'admin'
        )
    );

-- Allow service role full access
DROP POLICY IF EXISTS "Allow service role full access to infra_invoices" ON public.infra_invoices;
CREATE POLICY "Allow service role full access to infra_invoices" ON public.infra_invoices
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
