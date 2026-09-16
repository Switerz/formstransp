CREATE TABLE "public"."exportacoes_arquivos" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "escopo" TEXT NOT NULL,
    "transportadoraId" TEXT,
    "nomeArquivo" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "signedUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "totalLinhas" INTEGER NOT NULL,
    "totalPartes" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exportacoes_arquivos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exportacoes_arquivos_chave_key" ON "public"."exportacoes_arquivos"("chave");
CREATE INDEX "exportacoes_arquivos_transportadoraId_idx" ON "public"."exportacoes_arquivos"("transportadoraId");
CREATE INDEX "exportacoes_arquivos_status_expiresAt_idx" ON "public"."exportacoes_arquivos"("status", "expiresAt");

ALTER TABLE "public"."exportacoes_arquivos"
ADD CONSTRAINT "exportacoes_arquivos_transportadoraId_fkey"
FOREIGN KEY ("transportadoraId") REFERENCES "public"."transportadoras"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
