import "server-only";

function envObrigatoria(nome: string): string {
  const valor = process.env[nome]?.trim();

  if (!valor) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
  }

  return valor;
}

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

export async function obterGoogleDriveAccessToken(): Promise<string> {
  const resposta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: envObrigatoria("GOOGLE_DRIVE_CLIENT_ID"),
      client_secret: envObrigatoria("GOOGLE_DRIVE_CLIENT_SECRET"),
      refresh_token: envObrigatoria("GOOGLE_DRIVE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const dados = (await resposta.json()) as GoogleTokenResponse;

  if (!resposta.ok || !dados.access_token) {
    throw new Error(
      dados.error_description ??
        dados.error ??
        `Falha ao autenticar no Google Drive (${resposta.status}).`,
    );
  }

  return dados.access_token;
}

type CriarSessaoUploadParams = {
  nomeArquivo: string;
  tamanhoBytes: number;
  transportadoraId: string;
  transportadoraNome?: string | null;
};

export async function criarSessaoUploadDevolucao({
  nomeArquivo,
  tamanhoBytes,
  transportadoraId,
  transportadoraNome,
}: CriarSessaoUploadParams): Promise<string> {
  const accessToken = await obterGoogleDriveAccessToken();

  const metadata = {
    name: nomeArquivo,
    parents: [envObrigatoria("GOOGLE_DRIVE_FOLDER_ID")],
    appProperties: {
      formsTranspTipo: "devolucao_transportadora",
      transportadoraId,
      ...(transportadoraNome
        ? { transportadoraNome: transportadoraNome.slice(0, 120) }
        : {}),
    },
  };

  const resposta = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,md5Checksum",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "X-Upload-Content-Length": String(tamanhoBytes),
      },
      body: JSON.stringify(metadata),
      cache: "no-store",
    },
  );

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(
      `Falha ao iniciar upload no Google Drive (${resposta.status}): ${detalhe}`,
    );
  }

  const uploadUrl = resposta.headers.get("location");

  if (!uploadUrl) {
    throw new Error(
      "O Google Drive não retornou a URL da sessão de upload.",
    );
  }

  return uploadUrl;
}