"use client";

import { useRouter } from "next/navigation";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { PedidosTable } from "@/components/pedidos/PedidosTable";
import type { LinhaTabela } from "@/lib/pedidos-table-row";
import type { DevolucaoResumo } from "@/app/portal/minha-base/actions";
import type { BaseOriginalResumo } from "@/app/base-completa/actions";

type Tab = "original" | "updated" | "compare";

interface TransportadoraOption {
  id: string;
  nome: string;
}

interface BasePanelProps {
  linhas: LinhaTabela[];
  lastBaseUpdateLabel: string;
  hasBaseUpdate: boolean;
  initialResumo?: DevolucaoResumo | null;
  lastDevolucaoLabel?: string;
  hasDevolucaoHoje?: boolean;
  fillPending: number;
  fillPartial: number;
  fillDone: number;
  serverFillFilter?: "todas" | "preenchidas";
  totalRows?: number;
  page?: number;
  totalPages?: number;
  previousHref?: string;
  nextHref?: string;
  allHref?: string;
  filledHref?: string;
  toolbarDateFilter?: React.ReactNode;
  adminDownloadControl?: React.ReactNode;
  downloadHref?: string;
  /**
   * Opcional. Quando ausente (transportadora comum), o lado "Base
   * atualizada" fica indisponÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­vel junto com o resto do fluxo de
   * devoluÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o. Quando presente (Base Completa/acesso interno), a
   * devoluÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© enviada em nome da transportadora escolhida em
   * transportadorasParaSelecao (obrigatÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³rio nesse caso) - a Server
   * Action valida isso no servidor (requireInternalAdmin), nunca confia
   * sÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ no frontend.
   */
  uploadAction?: (formData: FormData) => Promise<DevolucaoResumo>;
  /**
   * Opcional. Quando ausente (transportadora comum), o lado "Base
   * original" continua bloqueado/decorativo, exatamente como sempre foi
   * (a base de origem ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© 100% automÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡tica via Intelipost). Quando presente
   * (Base Completa/acesso interno), libera o upload manual de origem -
   * protegido no servidor por requireInternalAdmin dentro da prÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³pria
   * action, nunca sÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ escondendo/mostrando botÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o.
   */
  uploadOriginalAction?: (formData: FormData) => Promise<BaseOriginalResumo>;
  /** Lista de transportadoras para o seletor da devoluÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o em modo interno. Sem isso, o upload de devoluÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o sabe a quem atribuir a base. */
  transportadorasParaSelecao?: TransportadoraOption[];
  downloadLabel?: string;
  backendNote?: string;
  carrierCurrentMode?: boolean;
}

const TAB_INFO: Record<Tab, { title: string; hint: (n: number) => string }> = {
  original: { title: "Visualização da base original", hint: (n) => (n ? `${n.toLocaleString("pt-BR")} registros carregados.` : "Nenhuma base carregada.") },
  updated: { title: "Visualização da base atualizada", hint: (n) => (n ? `${n.toLocaleString("pt-BR")} registros carregados.` : "Nenhuma base atualizada carregada.") },
  compare: { title: "Comparativo antes x depois", hint: () => "Alterações da última devolução recebida." },
};

export function BasePanel({
  linhas,
  lastBaseUpdateLabel,
  hasBaseUpdate,
  initialResumo = null,
  lastDevolucaoLabel = "Nenhuma devolução recebida",
  hasDevolucaoHoje = false,
  fillPending,
  fillPartial,
  fillDone,
  serverFillFilter,
  totalRows,
  page = 1,
  totalPages = 1,
  previousHref,
  nextHref,
  allHref,
  filledHref,
  toolbarDateFilter,
  adminDownloadControl,
  downloadHref,
  uploadAction,
  uploadOriginalAction,
  transportadorasParaSelecao,
  downloadLabel = "Baixar minha base",
  carrierCurrentMode = false,
  backendNote = "Você está autenticado como transportadora - os downloads e a devolução acima só afetam os pedidos vinculados à sua sessão.",
}: BasePanelProps) {
  const router = useRouter();
  const permiteDevolucao = Boolean(uploadAction);
  const permiteBaseOriginal = Boolean(uploadOriginalAction);
  const mostrarAccordion = permiteDevolucao || permiteBaseOriginal;
  const [accordionOpen, setAccordionOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("original");
  const [busca, setBusca] = useState("");
  const [filtroPreenchimento, setFiltroPreenchimento] = useState<"todas" | "preenchidas">("todas");
  const [mostrarProtegidas, setMostrarProtegidas] = useState(false);
  const [resumo, setResumo] = useState<DevolucaoResumo | null>(initialResumo);
  const [devolucaoRecebidaHoje, setDevolucaoRecebidaHoje] = useState(hasDevolucaoHoje);
  const [ultimaDevolucaoLabelAtual, setUltimaDevolucaoLabelAtual] = useState(lastDevolucaoLabel);
  const [erro, setErro] = useState<string | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [arquivoAtualNome, setArquivoAtualNome] = useState("");
  const [progressoUpload, setProgressoUpload] = useState(0);
  const [linhasUploadTotal, setLinhasUploadTotal] = useState(0);
  const [linhasUploadProcessadas, setLinhasUploadProcessadas] = useState(0);
  const [processandoUpload, setProcessandoUpload] = useState(false);

  const [origResumo, setOrigResumo] = useState<BaseOriginalResumo | null>(null);
  const [origErro, setOrigErro] = useState<string | null>(null);
  const [origPending, startOrigTransition] = useTransition();
  const [origProgresso, setOrigProgresso] = useState(0);
  const [origLinhasTotal, setOrigLinhasTotal] = useState(0);
  const [origLinhasProcessadas, setOrigLinhasProcessadas] = useState(0);
  const [arquivoOriginalNome, setArquivoOriginalNome] = useState("");

  async function onSubmit(formData: FormData) {
    setErro(null);
    setResumo(null);
    setProgressoUpload(0);
    setLinhasUploadTotal(0);
    setLinhasUploadProcessadas(0);
    setProcessandoUpload(true);

    try {
      const arquivo = formData.get("arquivo");

      if (!(arquivo instanceof File) || arquivo.size === 0) {
        throw new Error(
          "Selecione um arquivo .xlsx preenchido antes de enviar.",
        );
      }

      if (!arquivo.name.toLowerCase().endsWith(".xlsx")) {
        throw new Error("O arquivo precisa estar no formato .xlsx.");
      }

      // Arquivos menores continuam pelo servidor, pois esse fluxo já foi
      // validado em produção. Arquivos grandes vão direto ao Drive para não
      // ultrapassar o limite de corpo da função da Vercel.
      const LIMITE_UPLOAD_SERVIDOR = 4 * 1024 * 1024;

      let fileId: string | undefined;

      if (arquivo.size <= LIMITE_UPLOAD_SERVIDOR) {
        const uploadFormData = new FormData();
        uploadFormData.append("arquivo", arquivo);

        setProgressoUpload(10);

        const respostaUpload = await fetch(
          "/portal/minha-base/upload/enviar",
          {
            method: "POST",
            body: uploadFormData,
          },
        );

        const respostaTexto = await respostaUpload.text();
        let dadosUpload: {
          ok?: boolean;
          erro?: string;
          arquivo?: {
            id?: string;
            nome?: string;
          };
        } = {};

        try {
          dadosUpload = respostaTexto ? JSON.parse(respostaTexto) : {};
        } catch {
          throw new Error(
            respostaUpload.ok
              ? "O servidor retornou uma resposta inválida."
              : `O servidor recusou o arquivo (${respostaUpload.status}).`,
          );
        }

        if (!respostaUpload.ok || !dadosUpload.ok) {
          throw new Error(
            dadosUpload.erro ?? "Não foi possível enviar o arquivo.",
          );
        }

        fileId = dadosUpload.arquivo?.id;
        setProgressoUpload(40);
      } else {
        setProgressoUpload(5);

        const respostaInicio = await fetch(
          "/portal/minha-base/upload/iniciar",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              nomeArquivo: arquivo.name,
              tamanhoBytes: arquivo.size,
            }),
          },
        );

        const dadosInicio = (await respostaInicio.json()) as {
          uploadUrl?: string;
          contentType?: string;
          erro?: string;
        };

        if (!respostaInicio.ok || !dadosInicio.uploadUrl) {
          throw new Error(
            dadosInicio.erro ?? "Não foi possível iniciar o envio ao Google Drive.",
          );
        }

        const TAMANHO_CHUNK = 2 * 1024 * 1024;
        let inicio = 0;

        while (inicio < arquivo.size) {
          const fim = Math.min(inicio + TAMANHO_CHUNK, arquivo.size);
          const chunk = arquivo.slice(inicio, fim);

          const respostaChunk = await fetch(
            `/portal/minha-base/upload/chunk?uploadUrl=${encodeURIComponent(dadosInicio.uploadUrl)}&inicio=${inicio}&fim=${fim - 1}&total=${arquivo.size}`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  dadosInicio.contentType ??
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              },
              body: chunk,
            },
          );

          const dadosChunk = (await respostaChunk.json()) as {
            ok?: boolean;
            proximoInicio?: number;
            erro?: string;
            arquivo?: { id?: string };
          };

          if (!respostaChunk.ok || !dadosChunk.ok) {
            throw new Error(
              dadosChunk.erro ?? "Falha ao enviar uma parte do arquivo.",
            );
          }

          inicio =
            typeof dadosChunk.proximoInicio === "number"
              ? dadosChunk.proximoInicio
              : fim;

          // O último chunk (upload realmente completo) é o único que traz
          // o arquivo/fileId do Drive - os anteriores só confirmam "continue".
          if (dadosChunk.arquivo?.id) fileId = dadosChunk.arquivo.id;

          setProgressoUpload(
            Math.min(90, Math.round((inicio / arquivo.size) * 90)),
          );
        }
      }

      if (!fileId) {
        throw new Error(
          "O arquivo foi enviado, mas o Google Drive não confirmou o ID final. Tente novamente.",
        );
      }

      // Passo que faltava: sem chamar /confirmar, o arquivo fica órfão no
      // Drive e a devolução NUNCA é validada nem promovida a base atual -
      // nada muda de verdade, mesmo que o upload em si tenha funcionado.
      setProgressoUpload(95);
      const respostaConfirmar = await fetch(
        "/portal/minha-base/upload/confirmar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId }),
        },
      );

      const dadosConfirmar = (await respostaConfirmar.json()) as {
        ok?: boolean;
        erro?: string;
        alteracoesOperacionais?: number;
        totalLinhas?: number;
        mensagem?: string;
        arquivo?: { nome?: string };
      };

      if (!respostaConfirmar.ok || !dadosConfirmar.ok) {
        throw new Error(
          dadosConfirmar.erro ?? "Não foi possível confirmar a devolução recebida.",
        );
      }

      setProgressoUpload(100);

      const totalLinhasConfirmado = dadosConfirmar.totalLinhas ?? 0;
      const alteracoes = dadosConfirmar.alteracoesOperacionais ?? 0;
      setResumo({
        totalLinhas: totalLinhasConfirmado,
        aplicados: alteracoes,
        // Esta validação é por arquivo inteiro (aceita ou rejeita tudo, sem
        // decisão linha a linha) - não há como saber, por linha, "sem
        // alteração" vs "aplicado" além da contagem agregada que o servidor
        // já devolve. Diferença é reportada aqui como "sem alteração".
        semAlteracao: Math.max(0, totalLinhasConfirmado - alteracoes),
        erros: 0,
        pedidosNaoEncontrados: 0,
        pedidosDeOutraTransportadora: 0,
        // Sem detalhe linha a linha nesta validação por arquivo - a aba
        // "Comparativo" fica vazia para devoluções por este caminho (honesto
        // sobre o que esta validação consegue oferecer, não inventado).
        detalhes: [],
        arquivoNome: dadosConfirmar.arquivo?.nome,
      });

      setDevolucaoRecebidaHoje(true);

      setUltimaDevolucaoLabelAtual(
        new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          dateStyle: "short",
          timeStyle: "short",
        }),
      );

      setAccordionOpen(false);
      router.refresh();
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : "Não foi possível enviar a devolução.",
      );
    } finally {
      setProcessandoUpload(false);
    }
  }
  function onSubmitOriginal(formData: FormData) {
    if (!uploadOriginalAction) return;
    setOrigErro(null);
    setOrigResumo(null);
    setOrigProgresso(0);
    setOrigLinhasTotal(0);
    setOrigLinhasProcessadas(0);

    const arquivo = formData.get("arquivo");
    // Mesmo limite usado pela devolução: arquivos pequenos continuam pelo
    // caminho já validado em produção (Server Action direta); arquivos
    // grandes (a Base Completa pode passar de centenas de milhares de
    // linhas) vão para o Drive em blocos e são processados em lotes por
    // cursor, sem precisar que o admin divida o Excel manualmente.
    const LIMITE_UPLOAD_SERVIDOR = 4 * 1024 * 1024;

    if (!(arquivo instanceof File) || arquivo.size === 0) {
      setOrigErro("Selecione um arquivo .xlsx preenchido antes de enviar.");
      return;
    }

    if (arquivo.size <= LIMITE_UPLOAD_SERVIDOR) {
      startOrigTransition(async () => {
        try {
          const result = await uploadOriginalAction(formData);
          setOrigResumo(result);
        } catch (err) {
          setOrigErro(err instanceof Error ? err.message : "Não foi possível processar a base original.");
        }
      });
      return;
    }

    startOrigTransition(async () => {
      try {
        if (!arquivo.name.toLowerCase().endsWith(".xlsx")) {
          throw new Error("O arquivo precisa estar no formato .xlsx.");
        }

        setOrigProgresso(5);
        const respostaInicio = await fetch("/base-completa/upload-original/iniciar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nomeArquivo: arquivo.name, tamanhoBytes: arquivo.size }),
        });
        const dadosInicio = (await respostaInicio.json()) as {
          uploadUrl?: string;
          contentType?: string;
          erro?: string;
        };
        if (!respostaInicio.ok || !dadosInicio.uploadUrl) {
          throw new Error(dadosInicio.erro ?? "Não foi possível iniciar o envio ao Google Drive.");
        }

        const TAMANHO_CHUNK = 2 * 1024 * 1024;
        let inicio = 0;
        let fileId: string | undefined;

        while (inicio < arquivo.size) {
          const fim = Math.min(inicio + TAMANHO_CHUNK, arquivo.size);
          const chunk = arquivo.slice(inicio, fim);

          const respostaChunk = await fetch(
            `/base-completa/upload-original/chunk?uploadUrl=${encodeURIComponent(dadosInicio.uploadUrl)}&inicio=${inicio}&fim=${fim - 1}&total=${arquivo.size}`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  dadosInicio.contentType ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              },
              body: chunk,
            },
          );
          const dadosChunk = (await respostaChunk.json()) as {
            ok?: boolean;
            proximoInicio?: number;
            erro?: string;
            arquivo?: { id?: string };
          };
          if (!respostaChunk.ok || !dadosChunk.ok) {
            throw new Error(dadosChunk.erro ?? "Falha ao enviar uma parte do arquivo.");
          }
          inicio = typeof dadosChunk.proximoInicio === "number" ? dadosChunk.proximoInicio : fim;
          if (dadosChunk.arquivo?.id) fileId = dadosChunk.arquivo.id;
          setOrigProgresso(Math.min(30, Math.round((inicio / arquivo.size) * 30)));
        }

        if (!fileId) {
          throw new Error("O arquivo foi enviado, mas o Google Drive não confirmou o ID final. Tente novamente.");
        }

        // Processamento em lotes por cursor: cada chamada processa uma
        // fatia do arquivo (o servidor decide o tamanho da fatia) e diz se
        // já terminou. Sem limite de linhas artificial - o próprio admin
        // não precisa dividir o arquivo, o sistema cuida disso sozinho.
        let cursor = 0;
        let concluido = false;
        let totalLinhas = 0;
        let inseridos = 0;
        let atualizados = 0;
        let erros: BaseOriginalResumo["erros"] = [];

        while (!concluido) {
          const respostaLote = await fetch("/base-completa/upload-original/processar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId, cursor }),
          });
          const dadosLote = (await respostaLote.json()) as {
            ok?: boolean;
            erro?: string;
            concluido?: boolean;
            totalLinhas?: number;
            proximoCursor?: number;
            inseridos?: number;
            atualizados?: number;
            erros?: BaseOriginalResumo["erros"];
          };
          if (!respostaLote.ok || !dadosLote.ok) {
            throw new Error(dadosLote.erro ?? "Falha ao processar um lote da base original.");
          }

          totalLinhas = dadosLote.totalLinhas ?? totalLinhas;
          inseridos += dadosLote.inseridos ?? 0;
          atualizados += dadosLote.atualizados ?? 0;
          erros = [...erros, ...(dadosLote.erros ?? [])];
          cursor = dadosLote.proximoCursor ?? totalLinhas;
          concluido = Boolean(dadosLote.concluido);

          setOrigLinhasTotal(totalLinhas);
          setOrigLinhasProcessadas(Math.min(cursor, totalLinhas));
          setOrigProgresso(totalLinhas > 0 ? Math.min(100, 30 + Math.round((cursor / totalLinhas) * 70)) : 30);
        }

        setOrigResumo({ totalLinhas, inseridos, atualizados, erros });
      } catch (err) {
        setOrigErro(err instanceof Error ? err.message : "Não foi possível processar a base original.");
      }
    });
  }

  const violacoesProtegidas = resumo?.detalhes.flatMap((d) => d.violacoesProtegidas.map((v) => ({ ...v, linha: d.linha }))) ?? [];
  const tentativasBloqueadas = resumo?.detalhes.flatMap((d) => d.tentativasBloqueadas.map((v) => ({ ...v, linha: d.linha }))) ?? [];
  const alteracoesAplicadas = resumo?.detalhes.flatMap((d) => d.alteracoesAplicadas.map((v) => ({ ...v, linha: d.linha }))) ?? [];
  const temViolacao = violacoesProtegidas.length > 0;

  const usarFiltroServidor = Boolean(allHref && filledHref);

  const filtroAtual = usarFiltroServidor
    ? serverFillFilter ?? "todas"
    : filtroPreenchimento;

  const linhasExibidas =
    usarFiltroServidor
      ? linhas
      : filtroAtual === "preenchidas"
        ? linhas.filter((linha) => linha.fillStatus !== "pending")
        : linhas;

  const textoQuantidade =
    usarFiltroServidor && typeof totalRows === "number"
      ? filtroAtual === "preenchidas"
        ? `${totalRows.toLocaleString("pt-BR")} registros preenchidos.`
        : `${linhas.length.toLocaleString("pt-BR")} registros nesta página de ${totalRows.toLocaleString("pt-BR")} no total.`
      : TAB_INFO[activeTab].hint(linhas.length);

  return (
    <>
      {/* ---- Input de bases (accordion, 2 dropzones) ---- */}
      {/* SÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ existe quando hÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ pelo menos um dos dois uploads liberados. */}
      {mostrarAccordion ? (
        <div className={`upload-accordion ${accordionOpen ? "open" : ""}`} id="uploadAccordion">
        <button className="upload-toggle" type="button" onClick={() => setAccordionOpen((v) => !v)}>
          <div className="upload-toggle-main">
            <div className="upload-toggle-icon">↑</div>
            <div>
              <div className="upload-toggle-title">Input de bases</div>
              <div className="upload-toggle-sub">Abra somente quando precisar devolver uma base.</div>
            </div>
          </div>
          <div className="upload-chevron">⌄</div>
        </button>

        <div className="upload-content">
          <div className="upload-grid">
            <div className={`upload-mini ${permiteBaseOriginal ? "" : "locked"}`} id="originalUploadCard">
              <div className="upload-mini-head">
                <div>
                  <div className="upload-mini-role">Time de Transportes</div>
                  <div className="upload-mini-title">Base original</div>
                </div>
              </div>
              {permiteBaseOriginal ? (
                <form action={onSubmitOriginal}>
                  <label className="dropzone compact" htmlFor="fileOriginal">
                    <div className="drop-icon">↑</div>
                    <strong>
                      {origPending
                        ? `${arquivoOriginalNome || "Base original"} · ${origProgresso || 0}%`
                        : arquivoOriginalNome || "Selecionar base original"}
                    </strong>
                    <span>{arquivoOriginalNome ? "Arquivo selecionado" : "Mesmas colunas de origem da Base Completa"}</span>
                  </label>
                  <input
                    type="file"
                    id="fileOriginal"
                    name="arquivo"
                    accept=".xlsx"
                    required
                    disabled={origPending}
                    onChange={(event) => {
                      setArquivoOriginalNome(event.target.files?.[0]?.name ?? "");
                      setOrigProgresso(0);
                      setOrigErro(null);
                      setOrigResumo(null);
                    }}
                  />
                  <div className="mini-actions">
                    <button className="btn-secondary" type="submit" disabled={origPending}>
                      {origPending ? "Enviando..." : "Enviar base original"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <label className="dropzone compact" aria-disabled>
                    <div className="drop-icon">↑</div>
                    <strong>Selecionar base original</strong>
                    <span>Excel, CSV ou JSON</span>
                  </label>
                  <div className="access-note">
                    <div className="access-lock">🔒</div>
                    <div>Publicação exclusiva do Time de Transportes autorizado. A base original chega automaticamente pela integração.</div>
                  </div>
                </>
              )}
            </div>

            <div className={`upload-mini ${permiteDevolucao ? "" : "locked"}`} id="updatedUploadCard">
              <div className="upload-mini-head">
                <div>
                  <div className="upload-mini-role">Transportador</div>
                  <div className="upload-mini-title">Base atualizada</div>
                </div>
              </div>
              {permiteDevolucao ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void onSubmit(new FormData(event.currentTarget));
                  }}
                >
                  {transportadorasParaSelecao ? (
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label htmlFor="transportadoraIdDevolucao">Transportadora</label>
                      <select id="transportadoraIdDevolucao" name="transportadoraId" required defaultValue="">
                        <option value="" disabled>
                          Selecione...
                        </option>
                        {transportadorasParaSelecao.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <label className="dropzone compact" htmlFor="fileUpdated">
                    <div className="drop-icon">↑</div>
                    <strong>
                      {processandoUpload
                        ? `${arquivoAtualNome || "Base selecionada"} · ${progressoUpload || 0}%`
                        : arquivoAtualNome || "Subir base atualizada"}
                    </strong>
                    <span>{arquivoAtualNome ? "Arquivo selecionado" : "Mantenha a mesma estrutura de colunas"}</span>
                  </label>
                  <input
                    type="file"
                    id="fileUpdated"
                    name="arquivo"
                    accept=".xlsx"
                    required
                    disabled={processandoUpload}
                    onChange={(event) => {
                      setArquivoAtualNome(event.target.files?.[0]?.name ?? "");
                      setProgressoUpload(0);
                      setErro(null);
                      setResumo(null);
                    }}
                  />
                  <div className="mini-actions">
                    <button className="btn-secondary" type="submit" disabled={processandoUpload}>
                      {processandoUpload ? "Processando..." : devolucaoRecebidaHoje ? "Reenviar devolução" : "Enviar devolução"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="access-note">
                  <div className="access-lock">🔒</div>
                  <div>Devolução indisponível neste contexto.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {processandoUpload ? (
        <div className="compact-alert open" role="status" aria-live="polite">
          <div style={{ padding: "12px 16px", width: "100%" }}>
            <div className="compact-alert-title" style={{ marginBottom: 8 }}>
              ↑ Processando: {arquivoAtualNome || "arquivo selecionado"}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              {linhasUploadTotal > 0 ? (
                <>
                  {linhasUploadProcessadas.toLocaleString("pt-BR")} de {linhasUploadTotal.toLocaleString("pt-BR")} linhas concluídas · faltam {Math.max(0, linhasUploadTotal - linhasUploadProcessadas).toLocaleString("pt-BR")} · {progressoUpload}%
                </>
              ) : (
                <>Lendo e preparando o arquivo...</>
              )}
            </div>
            <div style={{ height: 8, borderRadius: 999, overflow: "hidden", background: "#dbe5f1" }}>
              <div
                style={{
                  width: `${progressoUpload}%`,
                  height: "100%",
                  background: "#2563eb",
                  transition: "width 250ms ease",
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {origPending ? (
        <div className="compact-alert open" role="status" aria-live="polite">
          <div style={{ padding: "12px 16px", width: "100%" }}>
            <div className="compact-alert-title" style={{ marginBottom: 8 }}>
              ↑ Processando base original: {arquivoOriginalNome || "arquivo selecionado"}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              {origLinhasTotal > 0 ? (
                <>
                  {origLinhasProcessadas.toLocaleString("pt-BR")} de {origLinhasTotal.toLocaleString("pt-BR")} linhas concluídas · faltam {Math.max(0, origLinhasTotal - origLinhasProcessadas).toLocaleString("pt-BR")} · {origProgresso}%
                </>
              ) : (
                <>Lendo e preparando o arquivo...</>
              )}
            </div>
            <div style={{ height: 8, borderRadius: 999, overflow: "hidden", background: "#dbe5f1" }}>
              <div
                style={{
                  width: `${origProgresso}%`,
                  height: "100%",
                  background: "#2563eb",
                  transition: "width 250ms ease",
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {erro ? (
        <div className="compact-alert open">
          <button type="button" className="compact-alert-toggle" disabled>
            <span className="compact-alert-title">⚠ Falha ao processar: {erro}</span>
          </button>
        </div>
      ) : null}

      {!processandoUpload && !erro && resumo && arquivoAtualNome ? (
        <div className="compact-alert open ok">
          <button type="button" className="compact-alert-toggle" disabled>
            <span className="compact-alert-title">
              ✓ Finalizado: {resumo.arquivoNome || arquivoAtualNome} · {resumo.totalLinhas.toLocaleString("pt-BR")} linha(s) lida(s) · {resumo.aplicados.toLocaleString("pt-BR")} atualizada(s) · {resumo.semAlteracao.toLocaleString("pt-BR")} sem alteração · {(resumo.erros + resumo.pedidosNaoEncontrados + resumo.pedidosDeOutraTransportadora).toLocaleString("pt-BR")} com pendência
            </span>
          </button>
        </div>
      ) : null}

      {origErro ? (
        <div className="compact-alert open">
          <button type="button" className="compact-alert-toggle" disabled>
            <span className="compact-alert-title">⚠ Falha ao processar base original: {origErro}</span>
          </button>
        </div>
      ) : null}

      {origResumo ? (
        <div className={`compact-alert open ${origResumo.erros.length ? "" : "ok"}`}>
          <button type="button" className="compact-alert-toggle" disabled>
            <span className="compact-alert-title">
              {origResumo.erros.length ? "⚠" : "✓"} Base original: {origResumo.totalLinhas} linha(s), {origResumo.inseridos}{" "}
              inserida(s), {origResumo.atualizados} atualizada(s), {origResumo.erros.length} erro(s).
            </span>
          </button>
          {origResumo.erros.length ? (
            <div className="tamper-list">
              {origResumo.erros.map((e, i) => (
                <div key={i} className="tamper-item">
                  <strong>
                    Linha {e.linha} · {e.pedido || "(sem pedido)"}
                  </strong>
                  <br />
                  {e.motivo}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ---- Painel de visualizaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o ---- */}
      <div className="card panel">
        <div className="tabs">
          <button
            className={`tab ${activeTab === "original" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveTab("original")}
          >
            {carrierCurrentMode
              ? "Base atual"
              : permiteDevolucao
                ? "Vis?o original"
                : "Base"}
          </button>

          {permiteDevolucao && !carrierCurrentMode ? (
            <button
              className={`tab ${activeTab === "updated" ? "active" : ""}`}
              type="button"
              onClick={() => setActiveTab("updated")}
            >
              Vis?o atualizada
            </button>
          ) : null}

          {permiteDevolucao ? (
            <button
              className={`tab ${activeTab === "compare" ? "active" : ""}`}
              type="button"
              onClick={() => setActiveTab("compare")}
            >
              Comparativo
            </button>
          ) : null}
        </div>

        <div className="backend-ready-bar" id="backendReadyBar">
          <div className="backend-ready-left">
            <span className="backend-ready-title">Base operacional</span>
            <span className="backend-pill">
              <span className="backend-dot" style={{ background: hasBaseUpdate ? "#16a34a" : "#94a3b8" }} />
              Última atualização: <strong>{lastBaseUpdateLabel}</strong>
            </span>
            <span className="backend-pill">
              <span
                className="backend-dot"
                style={{ background: devolucaoRecebidaHoje ? "#16a34a" : "#94a3b8" }}
              />
              {devolucaoRecebidaHoje ? "Devolução recebida hoje:" : "Última devolução:"}{" "}
              <strong>{ultimaDevolucaoLabelAtual}</strong>
            </span>
          </div>
          <div className="backend-ready-right">
            <span className="backend-pill">
              <span className="backend-dot pending" />
              Pendentes: <strong>{fillPending}</strong>
            </span>
            <span className="backend-pill">
              <span className="backend-dot partial" />
              Parciais: <strong>{fillPartial}</strong>
            </span>
            <span className="backend-pill">
              <span className="backend-dot done" />
              Respondidos: <strong>{fillDone}</strong>
            </span>
          </div>
        </div>

        {processandoUpload ? (
          <div className="backend-loading show">
            Processando {arquivoAtualNome || "devolução"}{progressoUpload ? ` · ${progressoUpload}%` : "..."}
          </div>
        ) : null}

        {downloadHref && (
          <div className="panel-download">
            <a href={downloadHref} className="btn-transporter">
              <Download size={13} /> {downloadLabel}
            </a>
          </div>
        )}

        <div className="backend-note">{backendNote}</div>

        <div className="toolbar">
          <div className="toolbar-left">
            <strong>
              {carrierCurrentMode && activeTab === "original"
                ? "Base atual"
                : TAB_INFO[activeTab].title}
            </strong>
            <div>{activeTab === "compare" ? TAB_INFO[activeTab].hint(linhas.length) : textoQuantidade}</div>
            {adminDownloadControl ? <div style={{ marginTop: 12 }}>{adminDownloadControl}</div> : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {activeTab !== "compare" && !toolbarDateFilter ? (
                <select
                  value={filtroAtual}
                onChange={(e) => {
                  const valor = e.target.value as "todas" | "preenchidas";

                  if (usarFiltroServidor) {
                    const destino =
                      valor === "preenchidas" ? filledHref : allHref;

                    if (destino) {
                      window.location.href = destino;
                    }

                    return;
                  }

                  setFiltroPreenchimento(valor);
                }}
                aria-label="Filtrar preenchimento da base"
                style={{
                  height: 40,
                  padding: "0 12px",
                  border: "1px solid #d8dee8",
                  borderRadius: 8,
                  background: "#fff",
                  color: "#0f2742",
                  fontWeight: 600,
                }}
              >
                <option value="todas">Todas</option>
                <option value="preenchidas">Somente preenchidas</option>
              </select>
            ) : null}
              {toolbarDateFilter}


            <input
              className="search"
              placeholder="Pesquisar em qualquer coluna..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {activeTab !== "compare" ? (
          <>
          <PedidosTable
            linhas={linhasExibidas}
            busca={busca}
            mostrarProtegidas={mostrarProtegidas}
            onToggleProtegidas={() => setMostrarProtegidas((v) => !v)}
          />

          {usarFiltroServidor && filtroAtual === "todas" && totalPages > 1 ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
                paddingTop: 14,
              }}
            >
              {previousHref ? (
                <a className="btn-secondary" href={previousHref}>
                  ← Anterior
                </a>
              ) : (
                <span
                  className="btn-secondary"
                  style={{ opacity: 0.45, pointerEvents: "none" }}
                >
                  ← Anterior
                </span>
              )}

              <strong style={{ fontSize: 12 }}>
                Página {page.toLocaleString("pt-BR")} de {totalPages.toLocaleString("pt-BR")}
              </strong>

              {nextHref ? (
                <a className="btn-secondary" href={nextHref}>
                  Próxima →
                </a>
              ) : (
                <span
                  className="btn-secondary"
                  style={{ opacity: 0.45, pointerEvents: "none" }}
                >
                  Próxima →
                </span>
              )}
            </div>
          ) : null}
          </>
        ) : (
          <div>
            {!resumo ? (
              <div className="empty">Envie uma devolução para gerar o comparativo antes → depois.</div>
            ) : (
              <>
                <div className={`compact-alert integrity-compact ${alertOpen ? "open" : ""} ${temViolacao ? "" : "ok"}`} id="integrityAlert">
                  <button type="button" className="compact-alert-toggle" onClick={() => setAlertOpen((v) => !v)}>
                    <span className="compact-alert-title">
                      {temViolacao ? "⚠ Divergência crítica detectada na devolução" : "✓ Integridade dos campos protegidos preservada"}
                    </span>
                    <span className="compact-alert-action" />
                  </button>
                  {temViolacao ? (
                    <div className="compact-alert-body">
                      <div>A transportadora alterou informações que deveriam permanecer idênticas à base original. Revise antes de aceitar a devolução.</div>
                      <div className="tamper-list">
                        {violacoesProtegidas.map((v, i) => (
                          <div key={i} className="tamper-item">
                            <strong>
                              Linha {v.linha} · {v.campo}
                            </strong>
                            <br />
                            Original: "{String(v.antes)}" → Devolvido: "{String(v.depois)}" (não aplicado)
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="split">
                  <div className="split-box">
                    <div className="split-title">Campos operacionais aplicados (antes → depois)</div>
                    <div style={{ padding: 10 }}>
                      {alteracoesAplicadas.length === 0 ? (
                        <div className="empty">Nenhum campo novo aplicado nesta devolução.</div>
                      ) : (
                        <div className="tamper-list">
                          {alteracoesAplicadas.map((v, i) => (
                            <div key={i} className="tamper-item" style={{ borderColor: "#b6dfc5", background: "#f7fcf8" }}>
                              <strong>
                                Linha {v.linha} · {v.campo}
                              </strong>
                              <br />
                              "{String(v.antes) || "(vazio)"}" → "{String(v.depois)}"
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="split-box">
                    <div className="split-title">Campos já respondidos preservados (tentativa bloqueada)</div>
                    <div style={{ padding: 10 }}>
                      {tentativasBloqueadas.length === 0 ? (
                        <div className="empty">Nenhuma tentativa bloqueada nesta devolução.</div>
                      ) : (
                        <div className="tamper-list">
                          {tentativasBloqueadas.map((v, i) => (
                            <div key={i} className="tamper-item">
                              <strong>
                                Linha {v.linha} · {v.campo}
                              </strong>
                              <br />
                              Mantido: "{String(v.antes)}" (tentativa: "{String(v.depois)}")
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

