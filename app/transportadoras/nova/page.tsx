import { createTransportadora } from "@/app/actions";
import { requireInternalAdmin } from "@/lib/auth";

export default async function NovaTransportadoraPage() {
  await requireInternalAdmin("/transportadoras/nova");

  return (
    <main className="shell">
      <div className="page-title">
        <div>
          <h1>Cadastro de transportadora</h1>
          <p className="muted">Depois do cadastro, vincule usuários para que a transportadora envie pelo portal autenticado.</p>
        </div>
      </div>

      <form action={createTransportadora} className="card grid">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="nome">Nome</label>
            <input id="nome" name="nome" required />
          </div>
          <div className="field">
            <label htmlFor="cnpj">CNPJ</label>
            <input id="cnpj" name="cnpj" />
          </div>
          <div className="field">
            <label htmlFor="codigoSlug">Código da transportadora</label>
            <input id="codigoSlug" name="codigoSlug" placeholder="transportadora-exemplo" />
          </div>
          <div className="field">
            <label htmlFor="origem">Origem</label>
            <select id="origem" name="origem" defaultValue="real">
              <option value="real">Real</option>
              <option value="demo">Demo</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="emailsDestinatarios">E-mails destinatários</label>
            <input id="emailsDestinatarios" name="emailsDestinatarios" placeholder="time@empresa.com;operacao@empresa.com" />
          </div>
        </div>
        <label className="actions">
          <input name="ativo" type="checkbox" defaultChecked /> Ativa
        </label>
        <div className="actions">
          <button className="btn" type="submit">Salvar transportadora</button>
        </div>
      </form>
    </main>
  );
}
