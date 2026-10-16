// Datas sempre no fuso local do aparelho.
// Proibido: new Date().toISOString().slice(0, 10) e new Date("AAAA-MM-DD") (ambos usam UTC).

export type Periodo = { ano: number; mes: number }; // mes: 1–12

const dois = (n: number) => String(n).padStart(2, "0");

/** Date → "AAAA-MM-DD" usando o fuso local. */
export function formatarData(data: Date): string {
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
}

/** Hoje no fuso local, como "AAAA-MM-DD". */
export function hoje(agora: Date = new Date()): string {
  return formatarData(agora);
}

/** "AAAA-MM-DD" → Date à meia-noite local. Lança erro se a data não existir. */
export function parseData(texto: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) throw new Error(`Data inválida: ${texto}`);
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    throw new Error(`Data inválida: ${texto}`);
  }
  return data;
}

/** Último dia do mês (mes 1–12). Fevereiro considera ano bissexto. */
export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

export function periodoAtual(agora: Date = new Date()): Periodo {
  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
}

export function proximoMes({ ano, mes }: Periodo): Periodo {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

export function mesAnterior({ ano, mes }: Periodo): Periodo {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}

export function mesmoPeriodo(a: Periodo, b: Periodo): boolean {
  return a.ano === b.ano && a.mes === b.mes;
}
