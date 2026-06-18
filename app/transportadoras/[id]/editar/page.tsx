import { notFound } from "next/navigation";
import { updateTransportadora } from "@/app/actions";
import { requireInternalAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditarTransportadoraPage({ params }: { params: Promise<{ id: string }> }) {
  await requireInternalAdmin("/transportadoras");

  const { id } = await params;
  const transportadora = await prisma.transportadora.findUnique({ where: { id } });
  if (!transportadora) notFound();

  const updateAction = updateTransportadora.bind(null, transportadora.id);

  return (
    <main className="shell">
      <div className="page-title">
        <div>
          <h1>Editar transportadora</h1>
          <p className="muted">{transportadora.nome}</p>
        </div>
      </div>

      <section>
        <form action={updateAction} className="card grid">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="nome">Nome</label>
              <input id="nome" name="nome" defaultValue={transportadora.nome} required />
            </div>
            <div className="field">
              <label htmlFor="cnpj">CNPJ</label>
              <input id="cnpj" name="cnpj" defaultValue={transportadora.cnpj ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="codigoSlug">Código da transportadora</label>
              <input id="codigoSlug" name="codigoSlug" defaultValue={transportadora.codigoSlug} required />
            </div>
            <div className="field">
              <label htmlFor="origem">Origem</label>
              <select id="origem" name="origem" defaultValue={transportadora.origem}>
                <option value="real">Real</option>
                <option value="demo">Demo</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="emailsDestinatarios">E-mails destinatários</label>
              <input id="emailsDestinatarios" name="emailsDestinatarios" defaultValue={transportadora.emailsDestinatarios ?? ""} />
            </div>
          </div>
          <label className="actions">
            <input name="ativo" type="checkbox" defaultChecked={transportadora.ativo} /> Ativa
          </label>
          <div className="actions">
            <button className="btn" type="submit">Salvar alterações</button>
          </div>
        </form>
      </section>
    </main>
  );
}
