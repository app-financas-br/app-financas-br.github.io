import { HashRouter, Navigate, Outlet, Route, Routes } from "react-router";
import { useAuth } from "./providers/AuthProvider";
import { AppLayout } from "./layout/AppLayout";
import { NAVEGACAO } from "./navegacao";
import { Login } from "../features/auth/Login";
import { Cadastro } from "../features/auth/Cadastro";
import { EsqueciSenha } from "../features/auth/EsqueciSenha";
import { NovaSenha } from "../features/auth/NovaSenha";
import { Dashboard } from "../features/dashboard/Dashboard";
import { Lancamentos } from "../features/lancamentos/Lancamentos";
import { Planejamento } from "../features/planejamento/Planejamento";
import { Configuracoes } from "../features/configuracoes/Configuracoes";
import { EmBreve } from "../components/ui/EmBreve";
import { t } from "../i18n/pt-BR";

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
  if (recuperandoSenha) return <NovaSenha />;

  return (
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
          <Route path="/configuracoes" element={<Configuracoes />} />
          {NAVEGACAO.filter((i) => !["/", "/planejamento", "/lancamentos", "/configuracoes"].includes(i.rota)).map((i) => (
            <Route key={i.rota} path={i.rota} element={<EmBreve fase={i.fase} />} />
          ))}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <HashRouter>
      <Rotas />
    </HashRouter>
  );
}
