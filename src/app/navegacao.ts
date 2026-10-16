import { ArrowLeftRight, BarChart3, LayoutDashboard, ListTodo, PiggyBank, Settings, Target, type LucideIcon } from "lucide-react";
import { t } from "../i18n/pt-BR";

export type ItemNav = {
  rota: string;
  titulo: string;
  /** Rótulo curto na barra inferior do celular. */
  curto: string;
  icone: LucideIcon;
  fase: number;
  /** Aparece na barra inferior (máx. 5). */
  noCelular: boolean;
};

export const NAVEGACAO: ItemNav[] = [
  { rota: "/", titulo: t.nav.dashboard, curto: t.nav.inicio, icone: LayoutDashboard, fase: 0, noCelular: true },
  { rota: "/lancamentos", titulo: t.nav.lancamentos, curto: t.nav.lancamentos, icone: ArrowLeftRight, fase: 1, noCelular: true },
  { rota: "/investimentos", titulo: t.nav.investimentos, curto: t.nav.investimentos, icone: PiggyBank, fase: 2, noCelular: true },
  { rota: "/metas", titulo: t.nav.metas, curto: t.nav.metas, icone: Target, fase: 2, noCelular: true },
  { rota: "/tarefas", titulo: t.nav.tarefas, curto: t.nav.tarefas, icone: ListTodo, fase: 3, noCelular: true },
  { rota: "/relatorios", titulo: t.nav.relatorios, curto: t.nav.relatorios, icone: BarChart3, fase: 3, noCelular: false },
  { rota: "/configuracoes", titulo: t.nav.configuracoes, curto: t.nav.configuracoes, icone: Settings, fase: 1, noCelular: false },
];

export function tituloDaRota(caminho: string): string {
  return NAVEGACAO.find((i) => i.rota === caminho)?.titulo ?? t.app.nome;
}
