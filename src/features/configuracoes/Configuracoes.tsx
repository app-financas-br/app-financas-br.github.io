import { Categorias } from "../categorias/Categorias";
import { ContasBancarias } from "../contas-bancarias/ContasBancarias";
import { t } from "../../i18n/pt-BR";

export function Configuracoes() {
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <section className="flex flex-col gap-3" aria-labelledby="secao-contas">
        <div>
          <h2 id="secao-contas" className="text-[length:var(--fs-lg)] font-semibold text-text">
            {t.contas.titulo}
          </h2>
          <p className="text-muted">{t.contas.subtitulo}</p>
        </div>
        <ContasBancarias />
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="secao-categorias">
        <div>
          <h2 id="secao-categorias" className="text-[length:var(--fs-lg)] font-semibold text-text">
            {t.categorias.titulo}
          </h2>
          <p className="text-muted">{t.categorias.subtitulo}</p>
        </div>
        <Categorias />
      </section>
    </div>
  );
}
