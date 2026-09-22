import "server-only";

export async function medirEtapa<T>(etapa: string, tarefa: () => Promise<T>): Promise<T> {
  const inicio = performance.now();
  try { return await tarefa(); }
  finally { console.info(`[tempo-portal] ${etapa}: ${Math.round(performance.now() - inicio)} ms`); }
}
