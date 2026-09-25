import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const ROOT = process.cwd();

const PASTA_BASES = path.join(
  ROOT,
  "scripts",
  "drive",
  "bases_transportadoras",
  "consolidadas",
);

const CAMINHO_ENV = path.resolve(
  ROOT,
  "..",
  ".env",
);

function carregarEnv(caminho: string) {
  if (!fs.existsSync(caminho)) {
    throw new Error(
      `.env não encontrado: ${caminho}`,
    );
  }

  const conteudo = fs.readFileSync(
    caminho,
    "utf8",
  );

  for (const linhaOriginal of conteudo.split(/\r?\n/)) {
    const linha = linhaOriginal.trim();

    if (
      !linha ||
      linha.startsWith("#")
    ) {
      continue;
    }

    const indice = linha.indexOf("=");

    if (indice <= 0) {
      continue;
    }

    const chave = linha
      .slice(0, indice)
      .trim();

    let valor = linha
      .slice(indice + 1)
      .trim();

    if (
      (valor.startsWith('"') &&
        valor.endsWith('"')) ||
      (valor.startsWith("'") &&
        valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }

    if (!process.env[chave]) {
      process.env[chave] = valor;
    }
  }
}

carregarEnv(CAMINHO_ENV);

const SECRET =
  process.env.PEDIDOS_IMPORT_SECRET?.trim();

if (!SECRET) {
  throw new Error(
    "PEDIDOS_IMPORT_SECRET não encontrado no .env pai.",
  );
}

/*
 * Primeiro teste serÃ¡ local.
 * Depois apontaremos para a aplicaÃ§Ã£o publicada.
 */
const BASE_URL =
  process.env.FORMS_TRANSP_PUBLICAR_URL?.trim() ||
  "http://localhost:3000";

type ConfigTransportadora = {
  id: string;
  nome: string;
  arquivo: string;
};

const TRANSPORTADORAS: ConfigTransportadora[] = [
  {
    id: "cmqiijd94000jsb5w2tr3u5mp",
    nome: "Anjun",
    arquivo: "base_Anjun.xlsx",
  },
  {
    id: "cmtlgxtpe0000sjyczu0jkdgr",
    nome: "BH Transportes",
    arquivo: "base_BH_Transportes.xlsx",
  },
  {
    id: "cmtlgwx0a0000sjy4g5xeexd4",
    nome: "Correios",
    arquivo: "base_Correios.xlsx",
  },
  {
    id: "cmqiijamv0004sb5waln3a4pn",
    nome: "Diálogo",
    arquivo: "base_Dialogo.xlsx",
  },
  {
    id: "cmqiijcrc000gsb5wpe4a1l3k",
    nome: "Diaslog",
    arquivo: "base_Diaslog.xlsx",
  },
  {
    id: "cmqiija510001sb5wzl6x26ye",
    nome: "J&T",
    arquivo: "base_J&T.xlsx",
  },
  {
    id: "cmqiijb9p0007sb5wpbcl5fsq",
    nome: "Log Serviços",
    arquivo: "base_Log_Servicos.xlsx",
  },
  {
    id: "cmqiijbs6000asb5wqtjnsavp",
    nome: "Logan",
    arquivo: "base_Logan.xlsx",
  },
  {
    id: "cmtlgxtqi0001sjyc5zk4lx82",
    nome: "Loggi Express",
    arquivo: "base_Loggi_Express.xlsx",
  },
];

function normalizarSelecao(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function selecionarTransportadoras(): ConfigTransportadora[] {
  const args = process.argv.slice(2);

  if (args.includes("--todas")) {
    return TRANSPORTADORAS;
  }

  const indice = args.findIndex(
    (arg) => arg === "--transportadora" || arg === "-t",
  );

  if (indice < 0 || !args[indice + 1]) {
    throw new Error(
      'Informe --transportadora "Nome" (ou -t "Nome") para publicar uma base, ou --todas para publicar as 9 bases.',
    );
  }

  const busca = normalizarSelecao(args[indice + 1]);
  const encontrada = TRANSPORTADORAS.find((item) =>
    [item.nome, item.arquivo, item.id].some(
      (valor) => normalizarSelecao(valor) === busca,
    ),
  );

  if (!encontrada) {
    throw new Error(
      `Transportadora não encontrada: ${args[indice + 1]}. Opções: ${TRANSPORTADORAS.map((t) => t.nome).join(", ")}`,
    );
  }

  return [encontrada];
}

async function contarLinhasXlsx(caminho: string): Promise<number> {
  const { execFileSync } = await import("node:child_process");

  const codigo = [
    "from openpyxl import load_workbook",
    "import sys",
    "wb = load_workbook(sys.argv[1], read_only=True, data_only=True)",
    "ws = wb['BASE']",
    "print(max(ws.max_row - 1, 0))",
    "wb.close()",
  ].join("; ");

  const resultado = execFileSync(
    "python",
    ["-c", codigo, caminho],
    { encoding: "utf8" }
  ).trim();

  const total = Number(resultado);

  if (!Number.isFinite(total)) {
    throw new Error(`N?o foi poss?vel contar registros de ${caminho}`);
  }

  return total;
}

async function iniciarUpload(
  transportadora: ConfigTransportadora,
  nomeArquivo: string,
  tamanhoBytes: number,
) {
  const resposta = await fetch(
    `${BASE_URL}/api/jobs/publicar-base/iniciar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pedidos-import-secret": SECRET!,
      },
      body: JSON.stringify({
        transportadoraId:
          transportadora.id,
        nomeArquivo,
        tamanhoBytes,
      }),
    },
  );

  const texto = await resposta.text();

  let dados: {
    ok?: boolean;
    uploadUrl?: string;
    contentType?: string;
    error?: string;
  };

  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error(
      `Resposta inválida ao iniciar upload (${resposta.status}): ${texto}`,
    );
  }

  if (
    !resposta.ok ||
    !dados.uploadUrl
  ) {
    throw new Error(
      `Falha ao iniciar upload (${resposta.status}): ${texto}`,
    );
  }

  return {
    uploadUrl: dados.uploadUrl,
    contentType:
      dados.contentType ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

async function enviarArquivoAoDrive(
  uploadUrl: string,
  contentType: string,
  conteudo: Buffer,
) {
  const resposta = await fetch(
    uploadUrl,
    {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length":
          String(conteudo.length),
      },
      body: new Uint8Array(conteudo),
    },
  );

  const texto = await resposta.text();

  if (!resposta.ok) {
    throw new Error(
      `Falha no upload ao Google Drive (${resposta.status}): ${texto}`,
    );
  }

  let dados: {
    id?: string;
  };

  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error(
      `Google Drive respondeu sem JSON válido: ${texto}`,
    );
  }

  if (!dados.id) {
    throw new Error(
      "Google Drive concluiu o upload, mas não retornou fileId.",
    );
  }

  return dados.id;
}

async function confirmarPublicacao(
  transportadora: ConfigTransportadora,
  fileId: string,
  totalLinhas: number,
) {
  const resposta = await fetch(
    `${BASE_URL}/api/jobs/publicar-base/confirmar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pedidos-import-secret": SECRET!,
      },
      body: JSON.stringify({
        fileId,
        transportadoraId:
          transportadora.id,
        totalLinhas,
      }),
    },
  );

  const texto = await resposta.text();

  let dados: {
    ok?: boolean;
    versoesAnterioresRemovidas?: number;
    error?: string;
  };

  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error(
      `Resposta inválida na confirmação (${resposta.status}): ${texto}`,
    );
  }

  if (
    !resposta.ok ||
    !dados.ok
  ) {
    throw new Error(
      `Falha ao confirmar publicaÃ§Ã£o (${resposta.status}): ${texto}`,
    );
  }

  return dados;
}

async function publicar(
  transportadora: ConfigTransportadora,
) {
  const caminho = path.join(
    PASTA_BASES,
    transportadora.arquivo,
  );

  if (!fs.existsSync(caminho)) {
    throw new Error(
      `Arquivo não encontrado: ${caminho}`,
    );
  }

  const stat = fs.statSync(caminho);

  if (
    !stat.isFile() ||
    stat.size <= 0
  ) {
    throw new Error(
      `Arquivo inválido: ${caminho}`,
    );
  }

  console.log();
  console.log("=".repeat(70));
  console.log(
    `PREPARANDO: ${transportadora.nome}`,
  );
  console.log("=".repeat(70));

  console.log(
    `Arquivo: ${transportadora.arquivo}`,
  );

  console.log(
    `Tamanho: ${stat.size.toLocaleString("pt-BR")} bytes`,
  );

  console.log(
    "Contando registros...",
  );

  const totalLinhas =
    await contarLinhasXlsx(caminho);

  console.log(
    `Linhas: ${totalLinhas.toLocaleString("pt-BR")}`,
  );

  if (totalLinhas <= 0) {
    throw new Error(
      `A base ${transportadora.nome} não possui registros.`,
    );
  }

  const conteudo =
    fs.readFileSync(caminho);

  const timestamp =
    new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

  const nomeSeguro =
    transportadora.nome
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        "_",
      );

  const nomeDrive =
    `base_${nomeSeguro}_${timestamp}.xlsx`;

  console.log(
    "1/3 Criando sessão no Drive...",
  );

  const sessao =
    await iniciarUpload(
      transportadora,
      nomeDrive,
      conteudo.length,
    );

  console.log(
    "2/3 Enviando arquivo diretamente ao Google Drive...",
  );

  const fileId =
    await enviarArquivoAoDrive(
      sessao.uploadUrl,
      sessao.contentType,
      conteudo,
    );

  console.log(
    `    Upload concluído. fileId: ${fileId}`,
  );

  console.log(
    "3/3 Confirmando publicaÃ§Ã£o...",
  );

  const confirmacao =
    await confirmarPublicacao(
      transportadora,
      fileId,
      totalLinhas,
    );

  console.log();
  console.log(
    `[OK] ${transportadora.nome} publicada.`,
  );

  console.log(
    `     ${totalLinhas.toLocaleString("pt-BR")} registros`,
  );

  console.log(
    `     Versões anteriores removidas: ${
      confirmacao.versoesAnterioresRemovidas ?? 0
    }`,
  );
}

async function main() {
  console.log(
    "FORMS TRANSP - PUBLICAÇÃO DE BASES",
  );

  console.log(
    `API: ${BASE_URL}`,
  );

  const selecionadas = selecionarTransportadoras();

  console.log(
    `Publicação selecionada: ${selecionadas.map((item) => item.nome).join(", ")}`,
  );

  for (
    const transportadora
    of selecionadas
  ) {
    await publicar(
      transportadora,
    );
  }

  console.log();
  console.log("=".repeat(70));
  console.log(
    "PUBLICAÇÃO FINALIZADA COM SUCESSO",
  );
  console.log("=".repeat(70));
}

main().catch((error) => {
  console.error();
  console.error(
    "PUBLICAÇÃO INTERROMPIDA:",
    error,
  );

  process.exitCode = 1;
});


