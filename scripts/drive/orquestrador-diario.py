from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

PASTA = Path(__file__).resolve().parent
ROOT = PASTA.parent.parent
PASTA_CONSOLIDADA = PASTA / "bases_transportadoras" / "consolidadas"
LOCK = PASTA / ".refresh-diario.lock"

TRANSPORTADORAS = [
    "base_Anjun.xlsx",
    "base_BH_Transportes.xlsx",
    "base_Correios.xlsx",
    "base_Dialogo.xlsx",
    "base_Diaslog.xlsx",
    "base_J&T.xlsx",
    "base_Log_Servicos.xlsx",
    "base_Logan.xlsx",
    "base_Loggi_Express.xlsx",
]


def log(msg: str) -> None:
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def adquirir_lock() -> None:
    try:
        fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        detalhe = LOCK.read_text(encoding="utf-8", errors="replace") if LOCK.exists() else ""
        raise RuntimeError(
            "Já existe uma atualização diária em andamento. "
            f"Lock: {LOCK}. Detalhe: {detalhe}"
        )
    with os.fdopen(fd, "w", encoding="utf-8") as arq:
        json.dump({"pid": os.getpid(), "inicio": time.strftime('%Y-%m-%d %H:%M:%S')}, arq)


def liberar_lock() -> None:
    try:
        LOCK.unlink(missing_ok=True)
    except Exception as exc:
        log(f"AVISO: não foi possível remover lock: {exc}")


def executar(etapa: str, comando: list[str], env: dict[str, str]) -> None:
    log(f"INÍCIO: {etapa}")
    subprocess.run(comando, cwd=ROOT, env=env, check=True)
    log(f"OK: {etapa}")


def validar_saidas() -> None:
    esperados = [PASTA_CONSOLIDADA / "BASE_GERAL.xlsx"] + [
        PASTA_CONSOLIDADA / nome for nome in TRANSPORTADORAS
    ]
    ausentes = [str(p) for p in esperados if not p.exists() or p.stat().st_size == 0]
    if ausentes:
        raise RuntimeError("Arquivos ausentes/vazios após consolidação:\n- " + "\n- ".join(ausentes))

    # Validação leve e sem carregar 130k linhas na memória.
    codigo = (
        "from openpyxl import load_workbook; import sys; "
        "p=sys.argv[1]; wb=load_workbook(p,read_only=True,data_only=True); "
        "ws=wb['BASE']; h=[ws.cell(1,c).value for c in range(1,26)]; "
        "assert len(h)==25 and all(x is not None for x in h), 'cabecalho invalido'; "
        "assert ws.max_row and ws.max_row>=1, 'planilha vazia'; wb.close()"
    )
    for caminho in esperados:
        subprocess.run([sys.executable, "-c", codigo, str(caminho)], check=True)
    log("OK: BASE_GERAL + 9 recortes validados antes da publicação")


def main() -> int:
    adquirir_lock()
    env = os.environ.copy()
    # Fluxo legado de upsert de pedidos fica desligado neste pipeline.
    env["FORMS_TRANSP_ENVIAR_BACKEND"] = "0"

    try:
        executar("Coleta GoCase", [sys.executable, str(PASTA / "gocase_drive.py")], env)
        executar("Coleta GoBeauty", [sys.executable, str(PASTA / "gobeauty_drive.py")], env)
        executar("Consolidação + preservação + recortes", [sys.executable, str(PASTA / "consolidar-bases.py")], env)
        validar_saidas()
        executar(
            "Publicação das 9 transportadoras",
            ["npx", "tsx", str(PASTA / "publicar-bases-drive.ts"), "--todas"],
            env,
        )
        log("SUCESSO: atualização diária concluída")
        return 0
    except subprocess.CalledProcessError as exc:
        log(f"FALHA: etapa interrompida (exit code {exc.returncode}). Nenhuma etapa posterior será executada.")
        return exc.returncode or 1
    except Exception as exc:
        log(f"FALHA: {exc}")
        return 1
    finally:
        liberar_lock()


if __name__ == "__main__":
    raise SystemExit(main())
