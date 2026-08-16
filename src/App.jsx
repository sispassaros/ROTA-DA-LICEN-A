import { useState, useEffect } from "react";
import { Feather, Check, Clock, Circle, ChevronRight, User, LayoutGrid, StickyNote, Plus, Minus, Loader2, UserPlus, X, Paperclip } from "lucide-react";

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

async function signupUser(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.msg || `${res.status}`);
  return data;
}

async function passwordLogin(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.msg || `${res.status}`);
  return tokensToSession(data);
}

async function refreshSession(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.msg || `${res.status}`);
  return tokensToSession(data);
}

function tokensToSession(data) {
  const payload = parseJwt(data.access_token);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    email: payload?.email,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
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
  const refreshToken = params.get("refresh_token");
  const expiresIn = params.get("expires_in");
  if (!accessToken) return null;
  const payload = parseJwt(accessToken);
  if (!payload?.email) return null;
  const session = {
    accessToken,
    refreshToken,
    email: payload.email,
    expiresAt: Date.now() + (Number(expiresIn) || 3600) * 1000,
  };
  window.history.replaceState(null, "", window.location.pathname);
  return session;
}

async function uploadAttachment(file, clientId, stageIndex, accessToken) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${clientId}/${stageIndex}-${Date.now()}-${safeName}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/attachments/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": file.type,
    },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return {
    name: file.name,
    type: file.type,
    url: `${SUPABASE_URL}/storage/v1/object/public/attachments/${path}`,
  };
}

function rowToClient(row) {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    email: row.email,
    stage: row.stage,
    startedAt: row.started_at,
    notes: row.notes || {},
    attachments: row.attachments || {},
    deadline: row.deadline || "",
    outcome: row.outcome || null,
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
  const label =
    status === "done" ? "concluído" : status === "current" ? "em andamento" : status === "recusada" ? "recusada" : "pendente";
  return <span className={`stamp stamp--${status}`}>{label}</span>;
}

function getStageStatus(i, client) {
  const lastIndex = STAGES.length - 1;
  if (i === lastIndex && client.stage === lastIndex) {
    return client.outcome === "recusada" ? "recusada" : "done";
  }
  if (i < client.stage) return "done";
  if (i === client.stage) return "current";
  return "pending";
}

function Timeline({ client, editable, onAdvance, onRetreat, onNote, onOutcome, onAttach, onRemoveAttachment }) {
  const lastIndex = STAGES.length - 1;
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  async function handleFileChange(i, e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploadingIndex(i);
    try {
      await onAttach(i, file);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadingIndex(null);
    }
  }

  return (
    <div className="timeline">
      <div className="timeline__spine" aria-hidden="true" />

      {STAGES.map((stage, i) => {
        const status = getStageStatus(i, client);
        const isLastReached = i === lastIndex && client.stage === lastIndex;
        const stageAttachments = client.attachments?.[i] || [];
        return (
          <div className={`checkpoint checkpoint--${status}`} key={stage.key}>
            <div className="checkpoint__marker">
              {status === "done" ? (
                <Check size={15} strokeWidth={3} />
              ) : status === "recusada" ? (
                <X size={13} strokeWidth={3} />
              ) : status === "current" ? (
                <Clock size={13} strokeWidth={2.5} />
              ) : (
                <Circle size={9} strokeWidth={2.5} />
              )}
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

              {stageAttachments.length > 0 && (
                <div className="attachments">
                  {stageAttachments.map((a, ai) => (
                    <div className="attachments__item" key={ai}>
                      <a href={a.url} target="_blank" rel="noopener noreferrer">
                        <Paperclip size={12} /> {a.name}
                      </a>
                      {editable && (
                        <button
                          type="button"
                          className="attachments__remove"
                          onClick={() => onRemoveAttachment(i, ai)}
                          title="Remover anexo"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {editable && (
                <label className="attachments__upload">
                  {uploadingIndex === i ? (
                    <>
                      <Loader2 size={12} className="spin" /> Enviando…
                    </>
                  ) : (
                    <>
                      <Paperclip size={12} /> Anexar PDF ou imagem
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
                    onChange={(e) => handleFileChange(i, e)}
                    disabled={uploadingIndex !== null}
                  />
                </label>
              )}
              {editable && uploadingIndex === i && uploadError && (
                <p className="login-error">Não foi possível enviar: {uploadError}</p>
              )}

              {isLastReached && editable && (
                <div className="outcome-picker">
                  <button
                    className={client.outcome !== "recusada" ? "outcome-picker__active" : ""}
                    onClick={() => onOutcome("liberada")}
                  >
                    Licença liberada
                  </button>
                  <button
                    className={client.outcome === "recusada" ? "outcome-picker__active outcome-picker__danger" : ""}
                    onClick={() => onOutcome("recusada")}
                  >
                    Licença recusada
                  </button>
                </div>
              )}
              {isLastReached && !editable && client.outcome === "recusada" && (
                <p className="checkpoint__note checkpoint__note--danger">Licença recusada pelo órgão ambiental.</p>
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

function LoginScreen({ onPasswordLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!email || !password) return;
    setStatus("sending");
    setError(null);
    try {
      const session = await passwordLogin(email.trim(), password);
      onPasswordLogin(session);
    } catch (e) {
      setError("e-mail ou senha incorretos");
      setStatus("idle");
    }
  }

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .app {
          --ink: #1b2e1f;
          --paper: #f6f0de;
          --paper-2: #ece0c0;
          --surface: #fbf8f0;
          --muted: #4a5142;
          --line: #ddc9a0;
          --accent: #1b4b91;
          --rust: #c23b2e;
          font-family: 'Inter', sans-serif;
          background: var(--paper);
          color: var(--ink);
          min-height: 100vh;
        }
        .brand__mark {
          width: 32px; height: 32px;
          border-radius: 7px;
          background: var(--accent);
          color: #ffffff;
          display: flex; align-items: center; justify-content: center;
        }
        .login-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          z-index: 1;
        }
        .login-card {
          max-width: 380px;
          width: 100%;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 30px 26px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
        }
        .login-card .brand__mark { margin: 0 auto 14px; }
        .login-card h1 {
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 20px;
          letter-spacing: -0.01em;
          margin: 0 0 6px;
        }
        .login-card p {
          font-size: 13.5px;
          color: var(--muted);
          margin: 0 0 20px;
          line-height: 1.5;
        }
        .login-card input {
          width: 100%;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          padding: 11px 13px;
          border: 1px solid var(--line);
          border-radius: 7px;
          background: var(--paper);
          margin-bottom: 12px;
        }
        .login-card button {
          width: 100%;
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 13px;
          background: var(--accent);
          color: #ffffff;
          border: none;
          padding: 12px;
          border-radius: 7px;
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
          color: var(--accent);
        }
        .login-toggle {
          background: transparent;
          color: var(--accent) !important;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          margin-top: 14px;
          border: none;
          text-decoration: underline;
          cursor: pointer;
        }

        .bg-split {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .bg-split__img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(0.9);
        }
        .bg-split::after {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--paper);
          opacity: 0.72;
        }
        .bg-split__credit {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 9.5px;
          color: var(--muted);
          white-space: nowrap;
          z-index: 1;
        }
      `}</style>
      <SideBirds />
      <div className="login-shell">
        <div className="login-card">
          <div className="brand__mark" style={{ display: "inline-flex" }}><Feather size={17} /></div>
          <h1>Rota da Licença</h1>
          {status === "sent" ? null : (
            <>
              <p>Digite seu e-mail e senha para acessar seu processo.</p>
              <form onSubmit={submit}>
                <input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type="password"
                  required
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit" disabled={status === "sending"}>
                  {status === "sending" ? "Entrando…" : "Entrar"}
                </button>
              </form>
              {error && <p className="login-error">Não foi possível entrar: {error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NewClientForm({ onCreated, onClose, accessToken }) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await signupUser(email.trim(), password);
      const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
      const [row] = await supaFetch(
        "clients",
        {
          method: "POST",
          body: JSON.stringify([
            { name, species, email: email.trim(), stage: 0, started_at: today, notes: {} },
          ]),
        },
        accessToken
      );
      onCreated(rowToClient(row));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="new-client">
      <form onSubmit={submit} className="new-client__form">
        <input placeholder="Nome completo" required value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Plantel (ex: Curió, Bicudo)" value={species} onChange={(e) => setSpecies(e.target.value)} />
        <input
          type="email"
          placeholder="E-mail do cliente (login)"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="text"
          placeholder="Senha de acesso (para repassar ao cliente)"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="new-client__actions">
          <button type="button" onClick={onClose} className="new-client__cancel">Cancelar</button>
          <button type="submit" disabled={saving}>{saving ? "Salvando…" : "Cadastrar cliente"}</button>
        </div>
        {error && <p className="login-error">Não foi possível cadastrar: {error}</p>}
      </form>
    </div>
  );
}

function EditClientForm({ client, onSaved, onClose, accessToken }) {
  const [name, setName] = useState(client.name);
  const [species, setSpecies] = useState(client.species || "");
  const [email, setEmail] = useState(client.email || "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const emailChanged = email.trim() !== (client.email || "");

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (emailChanged) {
        await signupUser(email.trim(), password);
      }
      const fields = { name, species, email: email.trim() };
      const [row] = await supaFetch(
        `clients?id=eq.${client.id}`,
        { method: "PATCH", body: JSON.stringify(fields) },
        accessToken
      );
      onSaved(rowToClient(row));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="new-client">
      <form onSubmit={submit} className="new-client__form">
        <input placeholder="Nome completo" required value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Plantel (ex: Curió, Bicudo)" value={species} onChange={(e) => setSpecies(e.target.value)} />
        <input
          type="email"
          placeholder="E-mail do cliente (login)"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {emailChanged && (
          <input
            type="text"
            placeholder="Nova senha (necessária pois o e-mail mudou)"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        {emailChanged && (
          <p className="edit-hint">
            O e-mail de login está mudando — depois de salvar, repasse o novo e-mail e a nova senha ao cliente.
          </p>
        )}
        <div className="new-client__actions">
          <button type="button" onClick={onClose} className="new-client__cancel">Cancelar</button>
          <button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</button>
        </div>
        {error && <p className="login-error">Não foi possível salvar: {error}</p>}
      </form>
    </div>
  );
}

const BIRD_PHOTOS = [
  {
    name: "Trinca-ferro",
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Flickr_-_Dario_Sanches_-_TRINCA-FERRO-VERDADEIRO_%28Saltator_similis%29.jpg?width=600",
  },
  {
    name: "Coleirinho",
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Flickr_-_Dario_Sanches_-_COLEIRINHO_%28Sporophila_caerulescens%29_%286%29.jpg?width=600",
  },
  {
    name: "Curió",
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Flickr_-_Dario_Sanches_-_CURI%C3%93_%28Sporophila_angolensis_-_Oryzoborus_angolensis%29.jpg?width=600",
  },
];

function SideBirds() {
  return (
    <div className="bg-split" aria-hidden="true">
      <img className="bg-split__img" src={BIRD_PHOTOS[0].url} alt="" />
      <p className="bg-split__credit">Foto: Dario Sanches, CC BY-SA 2.0, via Wikimedia Commons</p>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [view, setView] = useState("cliente");
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [adminTab, setAdminTab] = useState("ativos");
  const client = clients.find((c) => c.id === selectedId);
  const isAdmin = session?.email === ADMIN_EMAIL;

  useEffect(() => {
    const fromUrl = extractSessionFromUrl();
    if (fromUrl) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(fromUrl));
      setSession(fromUrl);
      return;
    }
    const stored = readStoredSession();
    if (stored?.refreshToken && stored.expiresAt < Date.now() + 60000) {
      refreshSession(stored.refreshToken)
        .then((s) => {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s));
          setSession(s);
        })
        .catch(() => {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          setSession(null);
        });
    } else {
      setSession(stored);
    }
  }, []);

  // Renova a sessão sozinha um pouco antes de vencer, para não precisar logar de novo
  useEffect(() => {
    if (!session?.refreshToken) return;
    const msUntilRefresh = Math.max(session.expiresAt - Date.now() - 5 * 60 * 1000, 10000);
    const timer = setTimeout(async () => {
      try {
        const next = await refreshSession(session.refreshToken);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
        setSession(next);
      } catch {
        logout();
      }
    }, msUntilRefresh);
    return () => clearTimeout(timer);
  }, [session]);

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
        {
          method: "PATCH",
          body: JSON.stringify({
            stage: next.stage,
            notes: next.notes,
            deadline: next.deadline,
            outcome: next.outcome,
          }),
        },
        session.accessToken
      );
    } catch (e) {
      setError(e.message);
    }
  }

  async function editClient(id, fields) {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...fields } : c)));
    try {
      await supaFetch(`clients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(fields) }, session.accessToken);
    } catch (e) {
      setError(e.message);
    }
  }

  async function attachFile(stageIndex, file) {
    const uploaded = await uploadAttachment(file, client.id, stageIndex, session.accessToken);
    const nextAttachments = {
      ...client.attachments,
      [stageIndex]: [...(client.attachments?.[stageIndex] || []), uploaded],
    };
    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, attachments: nextAttachments } : c)));
    await supaFetch(
      `clients?id=eq.${client.id}`,
      { method: "PATCH", body: JSON.stringify({ attachments: nextAttachments }) },
      session.accessToken
    );
  }

  async function removeAttachment(stageIndex, attachmentIndex) {
    const list = [...(client.attachments?.[stageIndex] || [])];
    list.splice(attachmentIndex, 1);
    const nextAttachments = { ...client.attachments, [stageIndex]: list };
    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, attachments: nextAttachments } : c)));
    try {
      await supaFetch(
        `clients?id=eq.${client.id}`,
        { method: "PATCH", body: JSON.stringify({ attachments: nextAttachments }) },
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
    return (
      <LoginScreen
        onPasswordLogin={(s) => {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s));
          setSession(s);
        }}
      />
    );
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; }
        .app {
          --ink: #1b2e1f;
          --paper: #f6f0de;
          --paper-2: #ece0c0;
          --surface: #fbf8f0;
          --muted: #4a5142;
          --line: #ddc9a0;
          --accent: #1b4b91;
          --accent-soft: #e4ebf6;
          --success: #2f7a45;
          --success-soft: #e6f0e8;
          --rust: #c23b2e;
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
          width: 32px; height: 32px;
          border-radius: 7px;
          background: var(--accent);
          color: #ffffff;
          display: flex; align-items: center; justify-content: center;
        }
        .brand__text {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 15.5px;
          line-height: 1.1;
          color: var(--ink);
        }
        .brand__text small {
          display: block;
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          font-size: 11px;
          letter-spacing: 0.02em;
          color: var(--muted);
          margin-top: 3px;
        }

        .switcher {
          display: flex;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 3px;
          gap: 2px;
        }
        .switcher button {
          border: none;
          background: transparent;
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 12.5px;
          padding: 7px 13px;
          border-radius: 6px;
          cursor: pointer;
          color: var(--muted);
          display: flex; align-items: center; gap: 6px;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .switcher button.active {
          background: var(--ink);
          color: #ffffff;
        }

        .hero {
          margin-bottom: 28px;
        }
        .hero__eyebrow {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 6px;
          font-weight: 500;
        }
        .hero h1 {
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 26px;
          letter-spacing: -0.01em;
          line-height: 1.2;
          margin: 0 0 8px;
        }
        .hero p {
          color: var(--muted);
          font-size: 14px;
          max-width: 52ch;
          line-height: 1.5;
          margin: 0;
        }

        .client-select {
          margin: 16px 0 28px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .client-pill {
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 12.5px;
          border: 1px solid var(--line);
          background: var(--surface);
          border-radius: 7px;
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--ink);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .client-pill.active {
          border-color: var(--accent);
          background: var(--accent);
          color: #ffffff;
        }
        .client-pill__dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--accent);
        }
        .client-pill.active .client-pill__dot {
          background: #ffffff;
        }

        .admin-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 12px;
        }
        .admin-tabs button {
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 12.5px;
          padding: 7px 13px;
          border-radius: 7px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--muted);
          cursor: pointer;
        }
        .admin-tabs button.active {
          background: var(--ink);
          border-color: var(--ink);
          color: #ffffff;
        }

        .client-detail-bar {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 20px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .client-detail-bar__row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .client-detail-bar__row strong {
          font-size: 14.5px;
        }
        .client-detail-bar__row button {
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 12px;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid var(--line);
          background: var(--paper);
          color: var(--ink);
          cursor: pointer;
        }
        .client-detail-bar__deadline {
          display: flex;
          flex-direction: column;
          gap: 5px;
          font-size: 11px;
          color: var(--muted);
          font-weight: 500;
        }
        .client-detail-bar__deadline input {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          padding: 8px 10px;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: var(--paper);
          color: var(--ink);
        }

        .timeline {
          position: relative;
          padding-left: 40px;
        }
        .timeline__spine {
          position: absolute;
          left: 15px;
          top: 4px;
          bottom: 4px;
          width: 2px;
          background: var(--line);
        }

        .checkpoint {
          position: relative;
          padding-bottom: 20px;
        }
        .checkpoint:last-child { padding-bottom: 0; }

        .checkpoint__marker {
          position: absolute;
          left: -40px;
          top: 2px;
          width: 20px; height: 20px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: var(--surface);
          border: 2px solid var(--line);
          color: var(--muted);
          z-index: 1;
        }
        .checkpoint--done .checkpoint__marker {
          background: var(--success);
          border-color: var(--success);
          color: #ffffff;
        }
        .checkpoint--current .checkpoint__marker {
          background: var(--accent);
          border-color: var(--accent);
          color: #ffffff;
        }
        .checkpoint--recusada .checkpoint__marker {
          background: var(--rust);
          border-color: var(--rust);
          color: #ffffff;
        }

        .checkpoint__card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 16px 18px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .checkpoint--current .checkpoint__card {
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent);
        }
        .checkpoint--pending .checkpoint__card {
          opacity: 0.65;
          box-shadow: none;
        }

        .checkpoint__eyebrow {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--muted);
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
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 15.5px;
          margin: 0;
          color: var(--ink);
        }
        .checkpoint__detail {
          font-size: 13px;
          color: var(--muted);
          margin: 6px 0 0;
          line-height: 1.5;
        }
        .checkpoint__note {
          margin: 10px 0 0;
          font-size: 12.5px;
          background: var(--paper-2);
          border-radius: 6px;
          padding: 8px 10px;
          display: flex;
          gap: 6px;
          align-items: flex-start;
          color: var(--ink);
        }
        .checkpoint__notefield {
          width: 100%;
          margin-top: 10px;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: var(--paper);
          font-family: 'Inter', sans-serif;
          font-size: 12.5px;
          padding: 8px 10px;
          resize: vertical;
          min-height: 40px;
        }

        .attachments {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 10px;
        }
        .attachments__item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .attachments__item a {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          color: var(--accent);
          background: var(--accent-soft);
          border-radius: 6px;
          padding: 6px 10px;
          text-decoration: none;
          flex: 1;
        }
        .attachments__remove {
          border: none;
          background: var(--paper-2);
          color: var(--muted);
          border-radius: 6px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .attachments__upload {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          font-size: 12px;
          font-weight: 500;
          color: var(--accent);
          border: 1px dashed var(--accent);
          border-radius: 6px;
          padding: 7px 12px;
          cursor: pointer;
        }
        .attachments__upload input {
          display: none;
        }

        .stamp {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 10.5px;
          letter-spacing: 0.02em;
          padding: 3px 9px;
          border-radius: 5px;
          white-space: nowrap;
        }
        .stamp--done { color: var(--success); background: var(--success-soft); }
        .stamp--current { color: var(--accent); background: var(--accent-soft); }
        .stamp--pending { color: var(--muted); background: var(--paper-2); }
        .stamp--recusada { color: var(--rust); background: #fbe8e5; }

        .outcome-picker {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .outcome-picker button {
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 12px;
          padding: 7px 12px;
          border-radius: 6px;
          border: 1px solid var(--line);
          background: var(--paper);
          color: var(--muted);
          cursor: pointer;
        }
        .outcome-picker__active {
          background: var(--success-soft) !important;
          border-color: var(--success) !important;
          color: var(--success) !important;
        }
        .outcome-picker__danger.outcome-picker__active {
          background: #fbe8e5 !important;
          border-color: var(--rust) !important;
          color: var(--rust) !important;
        }
        .checkpoint__note--danger {
          background: #fbe8e5;
          color: var(--rust);
        }

        .stage-controls {
          display: flex;
          gap: 10px;
          margin-top: 22px;
          padding-left: 0;
        }
        .stage-controls button {
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 12.5px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--ink);
          padding: 9px 14px;
          border-radius: 7px;
          cursor: pointer;
          display: flex; align-items: center; gap: 6px;
        }
        .stage-controls button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .stage-controls__primary {
          background: var(--accent) !important;
          color: #ffffff !important;
          border-color: var(--accent) !important;
        }

        .admin-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          margin-bottom: 26px;
        }
        .admin-summary__card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 14px 16px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .admin-summary__card b {
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 22px;
          display: block;
        }
        .admin-summary__card span {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--muted);
        }

        @media (max-width: 520px) {
          .hero h1 { font-size: 22px; }
        }

        .app--center {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }
        .spin {
          animation: spin 0.9s linear infinite;
          color: var(--accent);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .client-pill--new {
          background: transparent;
          border-style: dashed;
          color: var(--accent);
          box-shadow: none;
        }

        .new-client {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 16px 18px;
          margin-bottom: 24px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .new-client__form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .new-client__form input {
          font-family: 'Inter', sans-serif;
          font-size: 13.5px;
          padding: 10px 12px;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: var(--paper);
        }
        .new-client__actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .new-client__actions button {
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 12.5px;
          padding: 9px 14px;
          border-radius: 6px;
          cursor: pointer;
          border: 1px solid var(--accent);
          background: var(--accent);
          color: #ffffff;
        }
        .new-client__cancel {
          background: transparent !important;
          border-color: var(--line) !important;
          color: var(--ink) !important;
        }
        .edit-hint {
          font-size: 11.5px;
          color: var(--muted);
          margin: -4px 0 0;
        }

        .bg-birds {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
        }

        .shell { position: relative; z-index: 1; }

        .bg-split {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .bg-split__img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(0.9);
        }
        .bg-split::after {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--paper);
          opacity: 0.72;
        }
        .bg-split__credit {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 9.5px;
          color: var(--muted);
          white-space: nowrap;
          z-index: 1;
        }
      `}</style>

      <SideBirds />

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
              <b style={{ color: "var(--ink)" }}>{clients.length}</b>
              <span>processos ativos</span>
            </div>
            <div className="admin-summary__card">
              <b style={{ color: "var(--success)" }}>
                {clients.filter((c) => c.stage === STAGES.length - 1 && c.outcome !== "recusada").length}
              </b>
              <span>licenças liberadas</span>
            </div>
            <div className="admin-summary__card">
              <b style={{ color: "var(--accent)" }}>{clients.filter((c) => c.stage === 3).length}</b>
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
              : `Processo iniciado em ${client.startedAt}${client.deadline ? ` · Prazo para homologação: ${client.deadline}` : ""}`}
          </p>
        </div>

        {isAdmin && view === "admin" && (
          <div className="admin-tabs">
            <button className={adminTab === "ativos" ? "active" : ""} onClick={() => setAdminTab("ativos")}>
              Em andamento
            </button>
            <button className={adminTab === "liberados" ? "active" : ""} onClick={() => setAdminTab("liberados")}>
              Liberados
            </button>
            <button className={adminTab === "recusados" ? "active" : ""} onClick={() => setAdminTab("recusados")}>
              Recusados
            </button>
          </div>
        )}

        {isAdmin && (
          <div className="client-select">
            {clients
              .filter((c) => {
                if (!(view === "admin")) return true;
                const lastIndex = STAGES.length - 1;
                if (adminTab === "liberados") return c.stage === lastIndex && c.outcome !== "recusada";
                if (adminTab === "recusados") return c.stage === lastIndex && c.outcome === "recusada";
                return !(c.stage === lastIndex);
              })
              .map((c) => (
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
            {view === "admin" && !showNewClient && (
              <button className="client-pill client-pill--new" onClick={() => setShowNewClient(true)}>
                <UserPlus size={13} /> Novo cliente
              </button>
            )}
          </div>
        )}

        {isAdmin && view === "admin" && showNewClient && (
          <NewClientForm
            accessToken={session.accessToken}
            onClose={() => setShowNewClient(false)}
            onCreated={(newClient) => {
              setClients((prev) => [...prev, newClient]);
              setSelectedId(newClient.id);
              setShowNewClient(false);
            }}
          />
        )}

        {isAdmin && view === "admin" && editingClient && client && (
          <EditClientForm
            client={client}
            accessToken={session.accessToken}
            onClose={() => setEditingClient(false)}
            onSaved={(updated) => {
              setClients((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
              setEditingClient(false);
            }}
          />
        )}

        {isAdmin && view === "admin" && client && !showNewClient && !editingClient && (
          <div className="client-detail-bar">
            <div className="client-detail-bar__row">
              <strong>{client.name}</strong>
              <button onClick={() => setEditingClient(true)}>Editar cliente</button>
            </div>
            <label className="client-detail-bar__deadline">
              Prazo para homologação
              <input
                type="text"
                placeholder="ex: 30 dias, ou 15/09/2026"
                value={client.deadline}
                onChange={(e) => updateClient(client.id, (c) => ({ ...c, deadline: e.target.value }))}
              />
            </label>
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
          onOutcome={(outcome) => updateClient(client.id, (c) => ({ ...c, outcome }))}
          onAttach={attachFile}
          onRemoveAttachment={removeAttachment}
        />
      </div>
    </div>
  );
}
