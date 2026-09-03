ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS "quantidadeOcorrencias" INTEGER,
  ADD COLUMN IF NOT EXISTS "ultimaOcorrenciaMicro" TEXT;
