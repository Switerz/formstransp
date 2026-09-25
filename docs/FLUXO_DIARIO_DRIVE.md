# Forms Transp — fluxo diário Drive

Fluxo oficial preparado para agendamento:

1. `gocase_drive.py`
2. `gobeauty_drive.py`
3. `consolidar-bases.py`
4. validação da `BASE_GERAL.xlsx` e dos 9 recortes
5. `publicar-bases-drive.ts --todas`

Entrada futura do Airflow: executar `python scripts/drive/orquestrador-diario.py` uma vez ao dia.

## Fluxo legado

O envio massivo de pedidos dos coletores para `FORMS_TRANSP_API_URL` fica **desligado por padrão**. Só é reativado explicitamente com `FORMS_TRANSP_ENVIAR_BACKEND=1`.

O workflow antigo de geração/download não deve ser reativado em paralelo com este fluxo.

## Segurança operacional

- lock local impede duas execuções simultâneas do refresh no mesmo host;
- uma etapa com erro interrompe as seguintes;
- a consolidação mantém a troca atômica/backup da Base Geral já implementada;
- todos os 10 XLSX (Base Geral + 9 transportadoras) são validados antes da primeira publicação;
- publicação usa o publicador único do Drive.

## Limite ainda dependente do Airflow

O lock local não coordena hosts diferentes. Quando o job for ligado ao Airflow, o DAG deve ter `max_active_runs=1` (ou mecanismo compartilhado equivalente) e o refresh deve participar do mesmo controle de versão usado pelo portal para eliminar a corrida `refresh x devolução` entre máquinas/processos diferentes.
