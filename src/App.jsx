import { useState, useEffect } from "react";
import { Feather, Check, Clock, Circle, ChevronRight, User, LayoutGrid, StickyNote, Plus, Minus, Loader2 } from "lucide-react";

const SUPABASE_URL = "https://xoxdqbdmryhcqxunvpxd.supabase.co";
const SUPABASE_KEY = "sb_publishable_mcE5RKGiKNhQLrfgEDdzdg_enaeizB6";
const ADMIN_EMAIL = "sispassaros@gmail.com";
const SESSION_STORAGE_KEY = "rota-da-licenca-session";

async function supaFetch(path, options = {}, accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken || SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.method && options.method !== "GET" ? { Prefer: "return=representation" } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

function parseJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function requestMagicLink(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, create_user: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
}

function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function extractSessionFromUrl() {
  if (!window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;
  const payload = parseJwt(accessToken);
  if (!payload?.email) return null;
  const session = { accessToken, email: payload.email };
  window.history.replaceState(null, "", window.location.pathname);
  return session;
}

function rowToClient(row) {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    stage: row.stage,
    startedAt: row.started_at,
    notes: row.notes || {},
  };
}

const STAGES = [
  {
    key: "ctf",
    title: "Cadastro Técnico Federal",
    field: "CTF — IBAMA",
    detail: "Abertura do seu registro junto ao Cadastro Técnico Federal de Atividades Potencialmente Poluidoras.",
  },
  {
    key: "sigam",
    title: "Cadastro no SIGAM",
    field: "SIGAM",
    detail: "Criação do seu cadastro no Sistema de Gestão Ambiental do estado.",
  },
  {
    key: "envio",
    title: "Envio da documentação",
    field: "SIGAM · Protocolo",
    detail: "Documentos do plantel e pessoais protocolados no sistema.",
  },
  {
    key: "analise",
    title: "Análise em andamento",
    field: "SIGAM · Órgão ambiental",
    detail: "Documentação em análise técnica pelo órgão responsável.",
  },
  {
    key: "liberada",
    title: "Licença liberada",
    field: "Licença de Criador Amador",
    detail: "Emissão concluída — plantel legalizado.",
  },
];

function StageStamp({ status }) {
  const label = status === "done" ? "concluído" : status === "current" ? "em andamento" : "pendente";
  return <span className={`stamp stamp--${status}`}>{label}</span>;
}

function Timeline({ client, editable, onAdvance, onRetreat, onNote }) {
  return (
    <div className="timeline">
      <svg className="timeline__spine" viewBox="0 0 24 640" preserveAspectRatio="none" aria-hidden="true">
        <path d="M12 0 C 18 60, 6 120, 12 180 S 18 300, 12 360 S 6 480, 12 540 S 18 600, 12 640" />
      </svg>

      {STAGES.map((stage, i) => {
        const status = i < client.stage ? "done" : i === client.stage ? "current" : "pending";
        return (
          <div className={`checkpoint checkpoint--${status}`} key={stage.key}>
            <div className="checkpoint__marker">
              {status === "done" ? <Check size={15} strokeWidth={3} /> : status === "current" ? <Clock size={13} strokeWidth={2.5} /> : <Circle size={9} strokeWidth={2.5} />}
            </div>
            <div className="checkpoint__card">
              <div className="checkpoint__eyebrow">{stage.field}</div>
              <div className="checkpoint__row">
                <h3>{stage.title}</h3>
                <StageStamp status={status} />
              </div>
              <p className="checkpoint__detail">{stage.detail}</p>

              {editable ? (
                <textarea
                  className="checkpoint__notefield"
                  placeholder="Observação para o cliente…"
                  value={client.notes[i] || ""}
                  onChange={(e) => onNote(i, e.target.value)}
                />
              ) : (
                client.notes[i] ? <p className="checkpoint__note"><StickyNote size={13} /> {client.notes[i]}</p> : null
              )}
            </div>
          </div>
        );
      })}

      {editable && (
        <div className="stage-controls">
          <button onClick={onRetreat} disabled={client.stage === 0}>
            <Minus size={14} /> Voltar etapa
          </button>
          <button onClick={onAdvance} disabled={client.stage === STAGES.length - 1} className="stage-controls__primary">
            <Plus size={14} /> Avançar etapa
          </button>
        </div>
      )}
    </div>
  );
}

function LoginScreen({ onSent }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setError(null);
    try {
      await requestMagicLink(email.trim());
      setStatus("sent");
      onSent?.();
    } catch (e) {
      setError(e.message);
      setStatus("idle");
    }
  }

  return (
    <div className="app">
      <style>{`
        .login-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .login-card {
          max-width: 380px;
          width: 100%;
          background: #fbf8f0;
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 30px 26px;
          text-align: center;
        }
        .login-card .brand__mark { margin: 0 auto 14px; }
        .login-card h1 {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: 22px;
          margin: 0 0 6px;
        }
        .login-card p {
          font-size: 13.5px;
          color: #5a6152;
          margin: 0 0 20px;
          line-height: 1.5;
        }
        .login-card input {
          width: 100%;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          padding: 11px 13px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: var(--paper);
          margin-bottom: 12px;
        }
        .login-card button {
          width: 100%;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          background: var(--ink);
          color: var(--paper);
          border: none;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
        }
        .login-card button:disabled { opacity: 0.5; cursor: not-allowed; }
        .login-error {
          font-size: 12px;
          color: var(--rust);
          margin-top: 10px;
        }
        .login-sent {
          font-size: 13.5px;
          color: var(--teal);
        }
      `}</style>
      <div className="login-shell">
        <div className="login-card">
          <div className="brand__mark" style={{ display: "inline-flex" }}><Feather size={17} /></div>
          <h1>Rota da Licença</h1>
          {status === "sent" ? (
            <p className="login-sent">Enviamos um link de acesso para <b>{email}</b>. Abra seu e-mail e clique nele para entrar.</p>
          ) : (
            <>
              <p>Digite seu e-mail para receber um link de acesso ao seu processo.</p>
              <form onSubmit={submit}>
                <input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit" disabled={status === "sending"}>
                  {status === "sending" ? "Enviando…" : "Enviar link de acesso"}
                </button>
              </form>
              {error && <p className="login-error">Não foi possível enviar: {error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = ainda checando, null = deslogado
  const [view, setView] = useState("cliente");
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const client = clients.find((c) => c.id === selectedId);
  const isAdmin = session?.email === ADMIN_EMAIL;

  useEffect(() => {
    const fromUrl = extractSessionFromUrl();
    if (fromUrl) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(fromUrl));
      setSession(fromUrl);
      return;
    }
    setSession(readStoredSession());
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const data = await supaFetch("clients?select=*&order=created_at.asc", {}, session.accessToken);
        if (!active) return;
        const mapped = data.map(rowToClient);
        setClients(mapped);
        if (mapped.length) setSelectedId(mapped[0].id);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [session]);

  async function updateClient(id, updater) {
    const current = clients.find((c) => c.id === id);
    const next = updater(current);
    setClients((prev) => prev.map((c) => (c.id === id ? next : c)));
    try {
      await supaFetch(
        `clients?id=eq.${id}`,
        { method: "PATCH", body: JSON.stringify({ stage: next.stage, notes: next.notes }) },
        session.accessToken
      );
    } catch (e) {
      setError(e.message);
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setClients([]);
  }

  if (session === undefined) {
    return (
      <div className="app app--center">
        <Loader2 className="spin" size={22} />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (loading) {
    return (
      <div className="app app--center">
        <Loader2 className="spin" size={22} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="app app--center">
        <p style={{ fontFamily: "monospace", fontSize: 13, maxWidth: 320, textAlign: "center" }}>
          Não foi possível carregar os dados: {error}
        </p>
      </div>
    );
  }
  if (!client) {
    return (
      <div className="app app--center">
        <p style={{ fontFamily: "monospace", fontSize: 13 }}>
          {isAdmin ? "Nenhum cliente cadastrado ainda." : "Não encontramos um processo com esse e-mail. Fale com seu consultor."}
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; }
        .app {
          --ink: #1e2b21;
          --paper: #f3eee0;
          --paper-2: #ece4d0;
          --gold: #a97c25;
          --teal: #3e6259;
          --rust: #8c3b2e;
          --line: #d8cdae;
          font-family: 'Inter', sans-serif;
          background: var(--paper);
          color: var(--ink);
          min-height: 100vh;
          padding: 0;
        }

        .shell {
          max-width: 880px;
          margin: 0 auto;
          padding: 28px 20px 80px;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 34px;
          gap: 12px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brand__mark {
          width: 34px; height: 34px;
          border-radius: 50%;
          background: var(--ink);
          color: var(--paper);
          display: flex; align-items: center; justify-content: center;
        }
        .brand__text {
          font-family: 'Fraunces', serif;
          font-size: 17px;
          line-height: 1.1;
        }
        .brand__text small {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--teal);
          margin-top: 2px;
        }

        .switcher {
          display: flex;
          background: var(--paper-2);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 3px;
          gap: 2px;
        }
        .switcher button {
          border: none;
          background: transparent;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 7px 14px;
          border-radius: 999px;
          cursor: pointer;
          color: var(--ink);
          display: flex; align-items: center; gap: 6px;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .switcher button.active {
          background: var(--ink);
          color: var(--paper);
        }

        .hero {
          margin-bottom: 30px;
        }
        .hero__eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 6px;
        }
        .hero h1 {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: 30px;
          line-height: 1.15;
          margin: 0 0 8px;
        }
        .hero p {
          color: #55604f;
          font-size: 14.5px;
          max-width: 52ch;
          line-height: 1.5;
          margin: 0;
        }

        .client-select {
          margin: 18px 0 30px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .client-pill {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          border: 1px solid var(--line);
          background: var(--paper-2);
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--ink);
        }
        .client-pill.active {
          border-color: var(--ink);
          background: var(--ink);
          color: var(--paper);
        }
        .client-pill__dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--gold);
        }

        .timeline {
          position: relative;
          padding-left: 46px;
        }
        .timeline__spine {
          position: absolute;
          left: 11px;
          top: 4px;
          bottom: 4px;
          width: 24px;
          height: calc(100% - 8px);
          stroke: var(--line);
          stroke-width: 2;
          fill: none;
        }

        .checkpoint {
          position: relative;
          padding-bottom: 26px;
        }
        .checkpoint:last-child { padding-bottom: 0; }

        .checkpoint__marker {
          position: absolute;
          left: -46px;
          top: 2px;
          width: 24px; height: 24px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: var(--paper);
          border: 2px solid var(--line);
          color: #a8a08a;
          z-index: 1;
        }
        .checkpoint--done .checkpoint__marker {
          background: var(--teal);
          border-color: var(--teal);
          color: var(--paper);
        }
        .checkpoint--current .checkpoint__marker {
          background: var(--gold);
          border-color: var(--gold);
          color: var(--paper);
        }

        .checkpoint__card {
          background: #fbf8f0;
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 16px 18px;
        }
        .checkpoint--current .checkpoint__card {
          border-color: var(--gold);
          box-shadow: 0 0 0 1px var(--gold) inset;
        }
        .checkpoint--pending .checkpoint__card {
          opacity: 0.6;
        }

        .checkpoint__eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #8a8267;
          margin-bottom: 4px;
        }
        .checkpoint__row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .checkpoint__row h3 {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: 17px;
          margin: 0;
        }
        .checkpoint__detail {
          font-size: 13.5px;
          color: #5a6152;
          margin: 6px 0 0;
          line-height: 1.5;
        }
        .checkpoint__note {
          margin: 10px 0 0;
          font-size: 12.5px;
          background: var(--paper-2);
          border-radius: 7px;
          padding: 8px 10px;
          display: flex;
          gap: 6px;
          align-items: flex-start;
          color: #47523e;
        }
        .checkpoint__notefield {
          width: 100%;
          margin-top: 10px;
          border: 1px dashed var(--line);
          border-radius: 7px;
          background: var(--paper);
          font-family: 'Inter', sans-serif;
          font-size: 12.5px;
          padding: 8px 10px;
          resize: vertical;
          min-height: 40px;
        }

        .stamp {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9.5px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid currentColor;
          white-space: nowrap;
        }
        .stamp--done { color: var(--teal); }
        .stamp--current { color: var(--gold); }
        .stamp--pending { color: #a8a08a; }

        .stage-controls {
          display: flex;
          gap: 10px;
          margin-top: 22px;
          padding-left: 0;
        }
        .stage-controls button {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border: 1px solid var(--ink);
          background: transparent;
          color: var(--ink);
          padding: 9px 14px;
          border-radius: 8px;
          cursor: pointer;
          display: flex; align-items: center; gap: 6px;
        }
        .stage-controls button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .stage-controls__primary {
          background: var(--ink) !important;
          color: var(--paper) !important;
        }

        .admin-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          margin-bottom: 26px;
        }
        .admin-summary__card {
          background: var(--paper-2);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .admin-summary__card b {
          font-family: 'Fraunces', serif;
          font-size: 22px;
          display: block;
        }
        .admin-summary__card span {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7362;
        }

        @media (max-width: 520px) {
          .hero h1 { font-size: 24px; }
        }

        .app--center {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }
        .spin {
          animation: spin 0.9s linear infinite;
          color: var(--gold);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="shell">
        <div className="topbar">
          <div className="brand">
            <div className="brand__mark"><Feather size={17} /></div>
            <div className="brand__text">
              Rota da Licença
              <small>Consultoria · Criação Amadora</small>
            </div>
          </div>
          <div className="switcher">
            {isAdmin && (
              <>
                <button className={view === "cliente" ? "active" : ""} onClick={() => setView("cliente")}>
                  <User size={13} /> Cliente
                </button>
                <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>
                  <LayoutGrid size={13} /> Painel
                </button>
              </>
            )}
            <button onClick={logout}>Sair</button>
          </div>
        </div>

        {isAdmin && view === "admin" && (
          <div className="admin-summary">
            <div className="admin-summary__card">
              <b>{clients.length}</b>
              <span>processos ativos</span>
            </div>
            <div className="admin-summary__card">
              <b>{clients.filter((c) => c.stage === STAGES.length - 1).length}</b>
              <span>licenças liberadas</span>
            </div>
            <div className="admin-summary__card">
              <b>{clients.filter((c) => c.stage === 3).length}</b>
              <span>em análise no órgão</span>
            </div>
          </div>
        )}

        <div className="hero">
          <div className="hero__eyebrow">{isAdmin && view === "admin" ? "Painel do consultor" : "Acompanhamento do processo"}</div>
          <h1>{isAdmin && view === "admin" ? "Seus clientes" : `Olá, ${client.name.split(" ")[0]}`}</h1>
          <p>
            {isAdmin && view === "admin"
              ? "Selecione um cliente abaixo para ver e atualizar o andamento do processo dele."
              : `Processo iniciado em ${client.startedAt} · Plantel: ${client.species}`}
          </p>
        </div>

        {isAdmin && (
          <div className="client-select">
            {clients.map((c) => (
              <button
                key={c.id}
                className={`client-pill ${selectedId === c.id ? "active" : ""}`}
                onClick={() => setSelectedId(c.id)}
              >
                <span className="client-pill__dot" />
                {view === "admin" ? c.name : c.name.split(" ")[0]}
                <ChevronRight size={12} />
              </button>
            ))}
          </div>
        )}

        <Timeline
          client={client}
          editable={isAdmin && view === "admin"}
          onAdvance={() =>
            updateClient(client.id, (c) => ({ ...c, stage: Math.min(c.stage + 1, STAGES.length - 1) }))
          }
          onRetreat={() =>
            updateClient(client.id, (c) => ({ ...c, stage: Math.max(c.stage - 1, 0) }))
          }
          onNote={(i, text) =>
            updateClient(client.id, (c) => ({ ...c, notes: { ...c.notes, [i]: text } }))
          }
        />
      </div>
    </div>
  );
}
