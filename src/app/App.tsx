import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Outlet, Route, Routes } from "react-router";
import { useAuth } from "./providers/AuthProvider";
import { AppLayout } from "./layout/AppLayout";
import { NAVEGACAO } from "./navegacao";
import { EmBreve } from "../components/ui/EmBreve";
import { t } from "../i18n/pt-BR";

// Cada tela é baixada só quando é aberta (o PWA guarda todas para usar offline)
const Login = lazy(() => import("../features/auth/Login").then((m) => ({ default: m.Login })));
const Cadastro = lazy(() => import("../features/auth/Cadastro").then((m) => ({ default: m.Cadastro })));
const EsqueciSenha = lazy(() => import("../features/auth/EsqueciSenha").then((m) => ({ default: m.EsqueciSenha })));
const NovaSenha = lazy(() => import("../features/auth/NovaSenha").then((m) => ({ default: m.NovaSenha })));
const Dashboard = lazy(() => import("../features/dashboard/Dashboard").then((m) => ({ default: m.Dashboard })));
const Lancamentos = lazy(() => import("../features/lancamentos/Lancamentos").then((m) => ({ default: m.Lancamentos })));
const Planejamento = lazy(() => import("../features/planejamento/Planejamento").then((m) => ({ default: m.Planejamento })));
const Importacao = lazy(() => import("../features/importacao/Importacao").then((m) => ({ default: m.Importacao })));
const Investimentos = lazy(() => import("../features/investimentos/Investimentos").then((m) => ({ default: m.Investimentos })));
const Metas = lazy(() => import("../features/metas/Metas").then((m) => ({ default: m.Metas })));
const Configuracoes = lazy(() => import("../features/configuracoes/Configuracoes").then((m) => ({ default: m.Configuracoes })));

function TelaCarregando() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-app text-muted" role="status">
      {t.carregando}
    </div>
  );
}

/** Só para quem está logado. */
function Protegida() {
  const { session } = useAuth();
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

/** Só para quem NÃO está logado (login, cadastro, esqueci a senha). */
function SoVisitante() {
  const { session } = useAuth();
  return session ? <Navigate to="/" replace /> : <Outlet />;
}

function Rotas() {
  const { carregando, recuperandoSenha } = useAuth();

  if (carregando) return <TelaCarregando />;
  // Link de recuperação aberto: a pessoa tem sessão temporária e precisa definir a nova senha.
  if (recuperandoSenha)
    return (
      <Suspense fallback={<TelaCarregando />}>
        <NovaSenha />
      </Suspense>
    );

  return (
    <Suspense fallback={<TelaCarregando />}>
    <Routes>
      <Route element={<SoVisitante />}>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      </Route>

      <Route element={<Protegida />}>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/planejamento" element={<Planejamento />} />
          <Route path="/lancamentos" element={<Lancamentos />} />
          <Route path="/importar" element={<Importacao />} />
          <Route path="/investimentos" element={<Investimentos />} />
          <Route path="/metas" element={<Metas />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          {NAVEGACAO.filter((i) => !["/", "/planejamento", "/lancamentos", "/configuracoes", "/investimentos", "/metas"].includes(i.rota)).map((i) => (
            <Route key={i.rota} path={i.rota} element={<EmBreve fase={i.fase} />} />
          ))}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <HashRouter>
      <Rotas />
    </HashRouter>
  );
}
