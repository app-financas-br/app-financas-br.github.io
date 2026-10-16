// Gravação de voz no navegador (docs/03-voz.md, "Comportamento no navegador").
import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_SEGUNDOS = 30;
const BARRAS = 12;
const SILENCIO_MS = 2500;

/** Primeiro formato que o navegador grava: webm/opus → webm → mp4 (Safari). */
export function escolherFormato(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
}

type Reconhecimento = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; start: () => void; abort: () => void };

/**
 * Grava até 30 s. `aoTerminar` recebe o áudio quando a pessoa para ou o tempo acaba
 * (null se nada foi captado, para a tela avisar em vez de ficar parada).
 * Ao cancelar, parar ou desmontar: para todas as trilhas do microfone e fecha o AudioContext
 * (o ícone de gravação do navegador some).
 */
export function useGravador(aoTerminar: (audio: Blob | null) => void) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [niveis, setNiveis] = useState<number[]>(() => new Array(BARRAS).fill(0));
  const [legenda, setLegenda] = useState("");
  const r = useRef({
    stream: null as MediaStream | null,
    gravador: null as MediaRecorder | null,
    partes: [] as Blob[],
    ctx: null as AudioContext | null,
    raf: 0,
    timer: 0,
    silencio: 0,
    ouviuSom: false,
    religou: false,
    reconhecimento: null as Reconhecimento | null,
    formato: "",
  });
  const terminar = useRef(aoTerminar);
  terminar.current = aoTerminar;

  /** Solta o microfone e tudo o que estava medindo o áudio. */
  const liberar = useCallback(() => {
    const s = r.current;
    cancelAnimationFrame(s.raf);
    window.clearInterval(s.timer);
    window.clearTimeout(s.silencio);
    s.stream?.getTracks().forEach((t) => t.stop());
    s.stream = null;
    void s.ctx?.close().catch(() => {});
    s.ctx = null;
    try {
      s.reconhecimento?.abort();
    } catch {
      /* navegador sem reconhecimento ativo */
    }
    s.reconhecimento = null;
    setGravando(false);
    setNiveis(new Array(BARRAS).fill(0));
  }, []);

  const medir = useCallback((stream: MediaStream) => {
    const s = r.current;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    s.ctx = new Ctx();
    // Alguns navegadores criam o contexto suspenso (política de autoplay): sem isso o equalizador fica parado
    void s.ctx.resume().catch(() => {});
    const analisador = s.ctx.createAnalyser();
    analisador.fftSize = 64;
    s.ctx.createMediaStreamSource(stream).connect(analisador);
    const dados = new Uint8Array(analisador.frequencyBinCount);
    const passo = () => {
      analisador.getByteFrequencyData(dados);
      const por = Math.floor(dados.length / BARRAS) || 1;
      const n = Array.from({ length: BARRAS }, (_, i) => {
        let soma = 0;
        for (let j = 0; j < por; j++) soma += dados[i * por + j] ?? 0;
        return soma / por / 255;
      });
      if (n.some((v) => v > 0.02)) s.ouviuSom = true;
      setNiveis(n);
      s.raf = requestAnimationFrame(passo);
    };
    s.raf = requestAnimationFrame(passo);
  }, []);

  const comecarGravador = useCallback(
    (stream: MediaStream) => {
      const s = r.current;
      s.partes = [];
      s.gravador = new MediaRecorder(stream, s.formato ? { mimeType: s.formato } : undefined);
      s.gravador.ondataavailable = (e) => e.data.size > 0 && s.partes.push(e.data);
      s.gravador.onstop = () => {
        const audio = new Blob(s.partes, { type: s.gravador?.mimeType || s.formato || "audio/webm" });
        liberar();
        terminar.current(audio.size > 0 ? audio : null);
      };
      s.gravador.start(250);
    },
    [liberar],
  );

  const parar = useCallback(() => {
    const g = r.current.gravador;
    if (g && g.state !== "inactive") g.stop();
    else liberar();
  }, [liberar]);

  const iniciar = useCallback(async () => {
    const s = r.current;
    s.formato = escolherFormato();
    s.ouviuSom = false;
    s.religou = false;
    setSegundos(0);
    setLegenda("");
    s.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    medir(s.stream);
    comecarGravador(s.stream);
    setGravando(true);

    // Contador e limite de 30 s
    s.timer = window.setInterval(() => {
      setSegundos((x) => {
        if (x + 1 >= MAX_SEGUNDOS) parar();
        return x + 1;
      });
    }, 1000);

    // Alguns celulares entregam a trilha muda: sem som em 2,5 s, religa o microfone uma vez
    s.silencio = window.setTimeout(async () => {
      if (s.ouviuSom || s.religou || !s.stream) return;
      s.religou = true;
      const antiga = s.stream;
      if (s.gravador) s.gravador.onstop = null;
      try {
        s.gravador?.stop();
      } catch {
        /* já parado */
      }
      antiga.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(s.raf);
      void s.ctx?.close().catch(() => {});
      s.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      medir(s.stream);
      comecarGravador(s.stream);
    }, SILENCIO_MS);

    // Legenda ao vivo (só visual), quando o navegador oferece
    const Rec = (window as unknown as { webkitSpeechRecognition?: new () => Reconhecimento; SpeechRecognition?: new () => Reconhecimento });
    const Classe = Rec.SpeechRecognition ?? Rec.webkitSpeechRecognition;
    if (Classe) {
      try {
        const rec = new Classe();
        rec.lang = "pt-BR";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (e) => setLegenda(Array.from(e.results, (res) => res[0]?.transcript ?? "").join(" "));
        rec.start();
        s.reconhecimento = rec;
      } catch {
        /* sem legenda: só grava */
      }
    }
  }, [comecarGravador, medir, parar]);

  /** Desiste da gravação: descarta o áudio e solta o microfone. */
  const cancelar = useCallback(() => {
    const g = r.current.gravador;
    if (g) g.onstop = null;
    try {
      if (g && g.state !== "inactive") g.stop();
    } catch {
      /* já parado */
    }
    liberar();
  }, [liberar]);

  // Sair da tela também solta o microfone
  useEffect(() => cancelar, [cancelar]);

  return { gravando, segundos, niveis, legenda, iniciar, parar, cancelar };
}
