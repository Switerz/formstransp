# Backlog FormsTransp

Atualizado em 2026-06-17.

## Status curto

- Dashboard cross-transportadora: forte e funcional.
- Portal autenticado das transportadoras: funcional.
- Link publico por token: desativado.
- Usuarios/senhas: funcional, com senha temporaria e troca obrigatoria.
- Supabase/PostgreSQL: schema principal criado e migracao `passwordMustChange` aplicada.
- Visao detalhada por transportadora em `/transportadoras/[id]`: funcional.
- Logs de qualidade do formulario: persistidos em `submission_quality_logs`.
- Onboarding de credenciais: controle de credencial enviada criado em `/usuarios`.

## O que falta da lista atual

### 1. Refinar a visao detalhada por transportadora

Status: funcional, com polimento futuro recomendado.

Ja existe `/transportadoras/[id]` com:

- saude operacional e score de risco;
- cobertura de envio;
- SLA recente e variacao;
- pendencias e bloqueios de qualidade;
- heatmap UF proprio;
- responsaveis de envio;
- observacoes recentes;
- acoes administrativas.

Falta opcional:

- adicionar grafico Recharts dedicado;
- filtrar o periodo da pagina;
- adicionar comentarios internos por transportadora.

### 2. Evoluir logs de qualidade do formulario

Status: base funcional.

Ja grava tentativas bloqueadas por inconsistencia de soma no submit autenticado:

- tentativa bloqueada;
- motivo da inconsistencia;
- transportadora;
- usuario;
- data do relatorio;
- timestamp;
- payload resumido.

Falta opcional:

- classificar severidade/tipo da inconsistencia em campos separados;
- expor agregados historicos no dashboard cross-transportadora;
- registrar tambem erros de parse/valores invalidos antes da consistencia.

Prioridade recomendada: media-alta.

### 3. Polir o onboarding real das transportadoras

Status: parcial-avancado.

Ja existe:

- criacao de usuarios;
- reset de senha;
- senha temporaria;
- troca obrigatoria no primeiro acesso/reset;
- script de provisionamento das contas reais.

Falta:

- melhorar texto operacional de entrega de credenciais;
- decidir se precisa exportar lista de pendentes;
- adicionar auditoria mais detalhada para reset/inativacao.

Prioridade recomendada: media.

## Proximos passos sugeridos

1. Rerodar critica visual/acessibilidade da nova `/transportadoras/[id]`.
2. Exibir agregados de `SubmissionQualityLog` no dashboard cross-transportadora.
3. Adicionar auditoria detalhada para criacao/reset/inativacao de usuario.
4. Criar rotina de limpeza de sessoes expiradas.
5. Remover ou neutralizar o campo legado `tokenPublicoFormulario` em migracao futura.
