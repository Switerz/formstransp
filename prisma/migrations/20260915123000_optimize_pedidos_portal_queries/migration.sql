-- Índices dos filtros usados pela Minha Base, Base Completa e Big Numbers.
-- Evitam varredura integral de pedidos para cada abertura do portal.
CREATE INDEX "pedidos_transportadoraId_dataCriacaoPedido_idx"
ON "pedidos"("transportadoraId", "dataCriacaoPedido");

CREATE INDEX "pedidos_transportadoraId_dataEntregaOrigem_dataCriacaoPedido_idx"
ON "pedidos"("transportadoraId", "dataEntregaOrigem", "dataCriacaoPedido");

CREATE INDEX "pedidos_transportadoraId_dataEntregaOrigem_previsaoEntregaTransportadoraOrigem_idx"
ON "pedidos"("transportadoraId", "dataEntregaOrigem", "previsaoEntregaTransportadoraOrigem");
