import { parseData } from "../../lib/datas";

/** "AAAA-MM-DD" que existe no calendário, com ano entre 2000 e 2100 (mesmo limite das tabelas). */
export function dataValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  try {
    const ano = parseData(texto).getFullYear();
    return ano >= 2000 && ano <= 2100;
  } catch {
    return false;
  }
}

/**
 * Rascunho do campo de data.
 *
 * O <input type="date"> do Chrome emite um valor a cada segmento digitado: ao digitar "31" no dia,
 * chega primeiro "…-03" e depois "…-31". Salvar (e re-renderizar com o valor do banco) no meio
 * disso reinicia a digitação e o "1" vira "01". Por isso:
 * - o valor digitado fica num rascunho local, que o servidor não sobrescreve enquanto o campo está em uso;
 * - só salva quando a data está completa e válida E a pessoa parou de digitar por `esperaMs`,
 *   ou ao sair do campo (blur/Enter);
 * - ao sair com data inválida, volta ao último valor salvo; campo vazio ao sair = limpar a data.
 */
export class RascunhoData {
  rascunho: string;
  private salvo: string;
  private focado = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    valor: string | null,
    private readonly onSalvar: (valor: string | null) => void,
    private readonly esperaMs = 800,
    private readonly aoMudar: () => void = () => {},
  ) {
    this.rascunho = valor ?? "";
    this.salvo = this.rascunho;
  }

  focar() {
    this.focado = true;
  }

  /** Cada evento de mudança do campo. */
  alterar(valor: string) {
    this.rascunho = valor;
    this.limparTimer();
    if (dataValida(valor)) this.timer = setTimeout(() => this.confirmar(false), this.esperaMs);
    this.aoMudar();
  }

  /** Saiu do campo (blur ou Enter): confirma na hora. */
  sair() {
    this.focado = false;
    this.limparTimer();
    this.confirmar(true);
  }

  /** O valor mudou fora do campo (banco, desfazer): só aceita se a pessoa não estiver editando. */
  sincronizar(valor: string | null) {
    if (this.focado || this.timer) return;
    this.rascunho = valor ?? "";
    this.salvo = this.rascunho;
    this.aoMudar();
  }

  /** Componente saindo da tela: não perde o que foi digitado. */
  encerrar() {
    if (this.timer) {
      this.limparTimer();
      this.confirmar(false);
    }
  }

  private limparTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private confirmar(saindo: boolean) {
    this.timer = null;
    const v = this.rascunho;
    if (v === this.salvo) return;

    if (v === "") {
      if (saindo) {
        this.salvo = "";
        this.onSalvar(null);
      }
      return;
    }
    if (!dataValida(v)) {
      if (saindo) {
        this.rascunho = this.salvo;
        this.aoMudar();
      }
      return;
    }
    this.salvo = v;
    this.onSalvar(v);
  }
}
