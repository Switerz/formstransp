ALTER TABLE "public"."pedidos"
  ADD COLUMN IF NOT EXISTS "dataDespacho" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "previsaoEntregaTransportadoraOriginal" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "microStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "statusTransportador" TEXT;
