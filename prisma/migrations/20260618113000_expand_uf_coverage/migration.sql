alter table public.previous_day_uf_metrics
  drop constraint if exists "previous_day_uf_metrics_uf_check";

alter table public.previous_day_uf_metrics
  add constraint "previous_day_uf_metrics_uf_check"
  check (uf in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ));
