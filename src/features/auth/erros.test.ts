import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApiError } from "@supabase/supabase-js";
import { mensagemDeErro } from "./erros";

describe("mensagemDeErro", () => {
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("navigator", { onLine: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("traduz credenciais inválidas e registra o erro real", () => {
    const erro = new AuthApiError("Invalid login credentials", 400, "invalid_credentials");
    expect(mensagemDeErro(erro)).toBe("E-mail ou senha incorretos.");
    expect(log).toHaveBeenCalledWith("[auth]", {
      name: "AuthApiError",
      status: 400,
      code: "invalid_credentials",
      message: "Invalid login credentials",
    });
  });

  it("TypeError com internet ligada NÃO vira 'Sem conexão'", () => {
    expect(mensagemDeErro(new TypeError("Failed to fetch"))).toBe("Algo deu errado (código: TypeError). Tente de novo.");
  });

  it("status 0 com internet ligada mostra o código HTTP", () => {
    expect(mensagemDeErro(new AuthApiError("falhou", 0, undefined))).toBe("Algo deu errado (código: HTTP 0). Tente de novo.");
  });

  it("código desconhecido aparece na mensagem genérica", () => {
    expect(mensagemDeErro(new AuthApiError("x", 422, "validation_failed"))).toBe(
      "Algo deu errado (código: validation_failed). Tente de novo.",
    );
  });

  it("'Sem conexão' só quando o navegador está offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(mensagemDeErro(new TypeError("Failed to fetch"))).toBe("Sem conexão. Verifique a internet.");
  });
});
