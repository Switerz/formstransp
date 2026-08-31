interface PeriodoFilterProps {
  action: string;
  de: string;
  ate: string;
  /** Outros campos do formulário atual (ex.: transportadoraId) que devem ser preservados ao submeter este filtro junto. */
  hiddenFields?: Record<string, string>;
}

/**
 * Filtro "Data: [Promessa Transporte ▼] / DE / ATÉ", conforme especificado.
 * Não existe um elemento equivalente literal no HTML oficial (conferido) -
 * reaproveita os componentes de formulário já padronizados no restante do
 * portal (.field/.btn), para não introduzir mais um estilo novo.
 */
export function PeriodoFilter({ action, de, ate, hiddenFields }: PeriodoFilterProps) {
  return (
    <form className="card form-grid" style={{ marginBottom: 18 }} action={action}>
      {Object.entries(hiddenFields ?? {}).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <div className="field">
        <label htmlFor="referenciaData">Data</label>
        <select id="referenciaData" name="referenciaData" defaultValue="promessa_transporte" disabled>
          <option value="promessa_transporte">Promessa Transporte</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="de">De</label>
        <input type="date" id="de" name="de" defaultValue={de} />
      </div>
      <div className="field">
        <label htmlFor="ate">Até</label>
        <input type="date" id="ate" name="ate" defaultValue={ate} />
      </div>
      <div className="actions" style={{ alignItems: "end" }}>
        <button className="btn" type="submit">
          Aplicar período
        </button>
      </div>
    </form>
  );
}
