// Gráficos (Recharts) carregados sob demanda: os números da tela aparecem antes, e o espaço do
// gráfico fica reservado com o mesmo tamanho enquanto a biblioteca chega (sem a tela "pular").
import { lazy, Suspense, type ComponentProps } from "react";
import { Skeleton } from "../ui/Skeleton";

const DonutLazy = lazy(() => import("./Donut").then((m) => ({ default: m.Donut })));
const SparklineLazy = lazy(() => import("./Sparkline").then((m) => ({ default: m.Sparkline })));
const AreaEvolucaoLazy = lazy(() => import("./AreaEvolucao").then((m) => ({ default: m.AreaEvolucao })));
const GraficoPatrimonioLazy = lazy(() => import("./GraficoPatrimonio").then((m) => ({ default: m.GraficoPatrimonio })));

const Grande = () => <Skeleton className="h-56 w-full md:h-64" />;

export function Donut(p: ComponentProps<typeof DonutLazy>) {
  return (
    <Suspense fallback={<div className="mx-auto aspect-square w-full max-w-[11rem]"><Skeleton className="h-full w-full !rounded-full" /></div>}>
      <DonutLazy {...p} />
    </Suspense>
  );
}

export function Sparkline(p: ComponentProps<typeof SparklineLazy>) {
  return (
    <Suspense fallback={<div className="h-10 w-full" aria-hidden />}>
      <SparklineLazy {...p} />
    </Suspense>
  );
}

export function AreaEvolucao(p: ComponentProps<typeof AreaEvolucaoLazy>) {
  return (
    <Suspense fallback={<Grande />}>
      <AreaEvolucaoLazy {...p} />
    </Suspense>
  );
}

export function GraficoPatrimonio(p: ComponentProps<typeof GraficoPatrimonioLazy>) {
  return (
    <Suspense fallback={<Grande />}>
      <GraficoPatrimonioLazy {...p} />
    </Suspense>
  );
}
