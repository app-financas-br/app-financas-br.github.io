import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Aviso } from "../../components/ui/Aviso";
import { useToast } from "../../components/ui/Toast";
import { contarLinhas, lerBackup, montarBackup, nomeArquivoBackup, TABELAS_BACKUP, type Backup, type TabelaBackup } from "../../lib/backup";
import { hoje } from "../../lib/datas";
import { baixarJson, contarAtual, lerTudo, restaurar } from "./api";
import { t } from "../../i18n/pt-BR";

type Confirmacao = { backup: Backup; hoje: Record<TabelaBackup, number>; arquivo: Record<TabelaBackup, number> };
const somar = (c: Record<string, number>) => Object.values(c).reduce((s, n) => s + n, 0);

/** Configurações → Backup: baixar todos os dados em .json e restaurar um arquivo (com confirmação). */
export function BackupDados() {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  const entrada = useRef<HTMLInputElement>(null);
  const [baixando, setBaixando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);

  const baixar = async () => {
    setBaixando(true);
    setErro(null);
    try {
      const tabelas = await lerTudo();
      const arquivo = nomeArquivoBackup(hoje());
      baixarJson(montarBackup(tabelas), arquivo);
      mostrar({ tipo: "info", texto: t.backup.baixado(arquivo, somar(contarLinhas(tabelas))) });
    } catch (e) {
      console.error("[backup] baixar", e);
      setErro(t.backup.erroBaixar);
    } finally {
      setBaixando(false);
    }
  };

  const escolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setLendo(true);
    setErro(null);
    try {
      const lido = lerBackup(await arquivo.text());
      if (!lido.ok) return setErro(t.backup.erroArquivo[lido.erro]);
      setConfirmacao({ backup: lido.backup, hoje: await contarAtual(), arquivo: contarLinhas(lido.backup.tabelas) });
    } catch (e) {
      console.error("[backup] ler", e);
      setErro(t.backup.erroBaixar);
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const confirmar = async () => {
    if (!confirmacao) return;
    setRestaurando(true);
    try {
      const total = await restaurar(confirmacao.backup);
      // Tudo mudou: descarta o cache e busca de novo o que estiver na tela
      qc.removeQueries({ type: "inactive" });
      await qc.invalidateQueries();
      setConfirmacao(null);
      mostrar({ tipo: "info", texto: t.backup.restaurado(somar(total)) });
    } catch (e) {
      console.error("[backup] restaurar", e);
      const err = e as { code?: string; message?: string };
      mostrar({ tipo: "erro", texto: err.code === "22023" && err.message ? err.message : t.backup.erroRestaurar });
    } finally {
      setRestaurando(false);
    }
  };

  const dataBackup = confirmacao?.backup.gerado_em
    ? new Date(confirmacao.backup.gerado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={baixar} disabled={baixando}>
          <Download size={16} aria-hidden /> {baixando ? t.backup.baixando : t.backup.baixar}
        </Button>
        <Button variante="contorno" onClick={() => entrada.current?.click()} disabled={lendo || restaurando}>
          <Upload size={16} aria-hidden /> {lendo ? t.backup.lendo : t.backup.restaurar}
        </Button>
        <input
          ref={entrada}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label={t.backup.restaurar}
          onChange={(e) => void escolherArquivo(e.target.files?.[0])}
        />
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <Modal
        aberto={confirmacao !== null}
        titulo={t.backup.confirmarTitulo}
        onFechar={() => !restaurando && setConfirmacao(null)}
        rodape={
          <>
            <Button variante="fantasma" onClick={() => setConfirmacao(null)} disabled={restaurando}>
              {t.parcelas.cancelar}
            </Button>
            <Button onClick={confirmar} disabled={restaurando} className="!bg-danger !text-text hover:opacity-90">
              {restaurando ? t.backup.restaurando : t.backup.confirmar}
            </Button>
          </>
        }
      >
        {confirmacao && (
          <div className="flex flex-col gap-3">
            <Aviso tipo="erro">{t.backup.confirmarTexto(dataBackup)}</Aviso>
            <table className="num w-full text-[length:var(--fs-sm)]">
              <thead>
                <tr className="text-muted">
                  <th className="py-1 text-left font-medium">{t.backup.colunaTabela}</th>
                  <th className="py-1 text-right font-medium">{t.backup.colunaHoje}</th>
                  <th className="py-1 text-right font-medium">{t.backup.colunaArquivo}</th>
                </tr>
              </thead>
              <tbody>
                {TABELAS_BACKUP.filter(({ tabela }) => confirmacao.hoje[tabela] + confirmacao.arquivo[tabela] > 0).map(({ tabela }) => (
                  <tr key={tabela} className="border-t border-border">
                    <td className="py-1 text-text">{t.backup.tabelas[tabela]}</td>
                    <td className="py-1 text-right text-muted">{confirmacao.hoje[tabela]}</td>
                    <td className="py-1 text-right text-text">{confirmacao.arquivo[tabela]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
