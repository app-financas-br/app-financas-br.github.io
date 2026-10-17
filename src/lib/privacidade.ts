// "Olhinho": ocultar valores em dinheiro na tela (só a exibição; digitação, Excel e backup não mudam).
// A escolha fica guardada neste aparelho. Padrão na primeira vez: valores visíveis.
import { useSyncExternalStore } from "react";

const CHAVE = "financas:ocultar-valores";

function lerGuardado(): boolean {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return false; // sem armazenamento (aba privada, testes): mostra os valores
  }
}

let ocultos = lerGuardado();
const ouvintes = new Set<() => void>();

/** true quando os valores em dinheiro devem aparecer como "R$ ••••". */
export function valoresOcultos(): boolean {
  return ocultos;
}

export function definirValoresOcultos(valor: boolean): void {
  ocultos = valor;
  try {
    localStorage.setItem(CHAVE, valor ? "1" : "0");
  } catch {
    /* sem armazenamento: vale só até recarregar */
  }
  ouvintes.forEach((f) => f());
}

const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};

export function useValoresOcultos(): [boolean, (valor: boolean) => void] {
  return [useSyncExternalStore(assinar, valoresOcultos, valoresOcultos), definirValoresOcultos];
}

/** Valor em dinheiro visível num texto ("R$ 12", "US$ 3", "€ 1", "-R$ 5"): usado no teste de vazamento. */
export const PADRAO_VALOR_VISIVEL = /(R\$|US\$|€)\s?[-−]?\d/;
