import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { useToast } from "../../components/ui/Toast";
import { usePeriodo } from "../../app/providers/PeriodoProvider";
import { usePreferencias } from "../preferencias/usePreferencias";
import { montarAbas, nomeArquivo, periodosDaExportacao } from "../../lib/exportacao";
import { baixar, buscarDadosExportacao } from "./api";
import { gerarExcel } from "./excel";
import { t } from "../../i18n/pt-BR";

type Escopo = "mes" | "ano";

/** Exporta o mês aberto ou o ano inteiro para .xlsx (Resumo + uma aba por tabela). */
export function ModalExportar({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { ano, mes } = usePeriodo();
  const { prefs } = usePreferencias();
  const { mostrar } = useToast();
  const [escopo, setEscopo] = useState<Escopo>("mes");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(false);

  const gerar = async () => {
    setGerando(true);
    setErro(false);
    try {
      const m = escopo === "mes" ? mes : undefined;
      const dados = await buscarDadosExportacao(ano, m);
      const arquivo = nomeArquivo(ano, m);
      baixar(await gerarExcel(montarAbas(dados, periodosDaExportacao(ano, m), prefs.so_pago), prefs.moeda), arquivo);
      mostrar({ tipo: "info", texto: t.exportacao.pronto(arquivo) });
      onFechar();
    } catch (e) {
      console.error("[exportacao]", e);
      setErro(true);
    } finally {
      setGerando(false);
    }
  };

  const opcoes: { valor: Escopo; rotulo: string }[] = [
    { valor: "mes", rotulo: t.exportacao.doMes(`${t.meses[mes - 1]} ${ano}`) },
    { valor: "ano", rotulo: t.exportacao.doAno(ano) },
  ];

  return (
    <Modal
      aberto={aberto}
      titulo={t.exportacao.titulo}
      onFechar={onFechar}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>
            {t.parcelas.cancelar}
          </Button>
          <Button onClick={gerar} disabled={gerando}>
            {gerando ? t.exportacao.gerando : t.exportacao.gerar}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-muted">{t.exportacao.explicacao}</p>
        <fieldset className="flex flex-col gap-2">
          {opcoes.map((o) => (
            <label
              key={o.valor}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 ${
                escopo === o.valor ? "border-border-glow bg-primary-soft text-text" : "border-border bg-input text-muted"
              }`}
            >
              <input type="radio" name="escopo-exportacao" value={o.valor} checked={escopo === o.valor} onChange={() => setEscopo(o.valor)} className="accent-[var(--primary)]" />
              {o.rotulo}
            </label>
          ))}
        </fieldset>
        {erro && <Aviso tipo="erro">{t.exportacao.erro}</Aviso>}
      </div>
    </Modal>
  );
}
