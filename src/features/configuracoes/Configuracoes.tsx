import { Categorias } from "../categorias/Categorias";
import { t } from "../../i18n/pt-BR";

export function Configuracoes() {
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
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
