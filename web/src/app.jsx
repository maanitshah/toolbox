import { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";

/* ---------- tiny hand-rolled icon set (no dependency) ---------- */
function Icon({ name, size = 16, style }) {
  const s = { width: size, height: size, ...style };
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", style: s };
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.6" y2="16.6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    x: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
    chevronLeft: <polyline points="15 18 9 12 15 6" />,
    chevronRight: <polyline points="9 18 15 12 9 6" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
    logOut: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    info: <><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><circle cx="12" cy="8" r="0.5" fill="currentColor" /></>,
    mapPin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></>,
    alertTriangle: <><path d="M10.6 3.9 2 19a1 1 0 0 0 .9 1.5h18.2a1 1 0 0 0 .9-1.5L13.4 3.9a1.6 1.6 0 0 0-2.8 0Z" /><line x1="12" y1="9.5" x2="12" y2="13.5" /><circle cx="12" cy="16.5" r="0.5" fill="currentColor" /></>,
    trash: <><polyline points="4 7 20 7" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /><path d="M9 7V4h6v3" /></>,
    zap: <polygon points="13 2 4 14 11 14 10 22 20 10 13 10" />,
    hammer: <><path d="m15 12-8.5 8.5a1.5 1.5 0 0 1-2-2L13 10" /><path d="m17 4 3 3-3 3-3-3z" /><path d="M13 10 10.5 7.5" /></>,
    leaf: <><path d="M11 20A7 7 0 0 1 4 13c0-6 8-11 16-11 0 8-5 16-11 16Z" /><path d="M4 20 15 9" /></>,
    droplet: <path d="M12 3s7 8 7 12a7 7 0 0 1-14 0c0-4 7-12 7-12Z" />,
    ruler: <><rect x="3" y="7" width="18" height="10" rx="1.5" /><line x1="7" y1="7" x2="7" y2="11" /><line x1="11" y1="7" x2="11" y2="11" /><line x1="15" y1="7" x2="15" y2="11" /><line x1="19" y1="7" x2="19" y2="11" /></>,
    box: <><path d="M21 8 12 3 3 8v8l9 5 9-5Z" /><path d="M3 8l9 5 9-5" /><line x1="12" y1="13" x2="12" y2="21" /></>,
    camera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.5" /></>,
    pencil: <><path d="M14.5 4.5a2.1 2.1 0 0 1 3 3L7 18l-4 1 1-4Z" /><line x1="13" y1="6" x2="17" y2="10" /></>,
  };
  return <svg {...common}>{paths[name] || null}</svg>;
}
const CAT_ICON = { power: "zap", hand: "hammer", garden: "leaf", clean: "droplet", access: "ruler", other: "box" };

const CATEGORIES = [
  { id: "power", label: "Power tools" },
  { id: "hand", label: "Hand tools" },
  { id: "garden", label: "Garden & yard" },
  { id: "clean", label: "Cleaning & wet/dry" },
  { id: "access", label: "Ladders & access" },
  { id: "other", label: "Other" },
];
const catMeta = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[5];
const CONDITIONS = ["Like new", "Good", "Fair — works, shows wear"];

/* ---------- date helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const fmtShort = (s) => fromKey(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtLong = (s) => fromKey(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const dateInRange = (d, s, e) => d >= s && d <= e;
const rangesOverlap = (aS, aE, bS, bE) => aS <= bE && bS <= aE;

function bookedRangesFor(toolId, bookings) { return bookings.filter((b) => b.toolId === toolId); }
function isToolFreeOn(toolId, dateStr, bookings) { return !bookedRangesFor(toolId, bookings).some((b) => dateInRange(dateStr, b.start, b.end)); }
function isToolFreeRange(toolId, s, e, bookings) { return !bookedRangesFor(toolId, bookings).some((b) => rangesOverlap(s, e, b.start, b.end)); }
function nextAvailable(toolId, bookings) {
  const ranges = bookedRangesFor(toolId, bookings).sort((a, b) => a.start.localeCompare(b.start));
  let cursor = today();
  for (let i = 0; i < 400; i++) {
    const key = toKey(cursor);
    const hit = ranges.find((r) => dateInRange(key, r.start, r.end));
    if (!hit) return key;
    cursor = addDays(fromKey(hit.end), 1);
  }
  return toKey(today());
}

/* ---------- API helper ---------- */
async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

/* ---------- photo helpers ---------- */
// Phone cameras produce huge files — shrink client-side before it ever hits the NAS.
function compressImage(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale); height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => { URL.revokeObjectURL(url); blob ? resolve(blob) : reject(new Error("Couldn't process that image.")); }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that image.")); };
    img.src = url;
  });
}
async function uploadPhoto(toolId, blob) {
  const form = new FormData();
  form.append("photo", blob, "photo.jpg");
  const res = await fetch(`/api/tools/${toolId}/photo`, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Photo upload failed.");
  return data.photoUrl;
}

/* ---------- shared styles ---------- */
const inputStyle = { fontFamily: "var(--font-body)", fontSize: 14.5, padding: "11px 13px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-card)", color: "var(--ink)", outline: "none", width: "100%" };
const primaryBtnStyle = { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, letterSpacing: 0.3, padding: "12px 18px", borderRadius: 8, border: "none", background: "var(--amber)", color: "#2A1B04" };
const ghostBtnStyle = { fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 13.5, padding: "9px 14px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", cursor: "pointer" };
const iconBtnStyle = { border: "1px solid var(--line)", background: "var(--bg-card)", borderRadius: 7, padding: 5, cursor: "pointer", color: "var(--ink)", display: "flex" };
const labelStyle = { fontSize: 12.5, fontFamily: "var(--font-mono)", color: "var(--ink-soft)", display: "flex", flexDirection: "column", gap: 4 };
const sectionTitleStyle = { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, color: "var(--ink)", margin: "0 0 4px" };
const chipStyle = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontFamily: "var(--font-body)", padding: "7px 11px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--bg-card)", color: "var(--ink)", cursor: "pointer" };
const chipActiveStyle = { background: "var(--green)", borderColor: "var(--green)", color: "#fff" };
const shellStyle = { minHeight: "100vh", background: "var(--bg)", backgroundImage: "radial-gradient(circle, rgba(90,86,64,0.12) 1px, transparent 1.3px)", backgroundSize: "16px 16px", display: "flex", flexDirection: "column", fontFamily: "var(--font-body)" };

/* ---------- calendar ---------- */
function MonthCalendar({ toolId, bookings, selRange, onPick }) {
  const [view, setView] = useState(() => { const t = today(); return new Date(t.getFullYear(), t.getMonth(), 1); });
  const year = view.getFullYear(), month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={() => setView(new Date(year, month - 1, 1))} className="icon-btn" style={iconBtnStyle}><Icon name="chevronLeft" size={16} /></button>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: 0.4, color: "var(--ink)" }}>
          {view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </div>
        <button onClick={() => setView(new Date(year, month + 1, 1))} className="icon-btn" style={iconBtnStyle}><Icon name="chevronRight" size={16} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, fontSize: 11, color: "var(--ink-soft)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} style={{ textAlign: "center" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = toKey(d);
          const isPast = key < toKey(today());
          const booked = !isToolFreeOn(toolId, key, bookings);
          const inSel = selRange.start && key >= selRange.start && key <= (selRange.end || selRange.start);
          const disabled = isPast || booked;
          return (
            <button key={i} disabled={disabled} onClick={() => onPick(key)} style={{
              aspectRatio: "1", borderRadius: 6, fontSize: 12.5, fontFamily: "var(--font-mono)",
              border: inSel ? "1.5px solid var(--green)" : "1px solid transparent",
              background: disabled ? (booked ? "rgba(181,68,46,0.14)" : "transparent") : inSel ? "rgba(79,122,61,0.18)" : "var(--bg)",
              color: disabled ? (booked ? "var(--rust)" : "var(--ink-soft)") : "var(--ink)",
              cursor: disabled ? "not-allowed" : "pointer", opacity: disabled && !booked ? 0.4 : 1,
            }}>{d.getDate()}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11.5, color: "var(--ink-soft)", fontFamily: "var(--font-mono)" }}>
        <span><i style={{ display: "inline-block", width: 9, height: 9, background: "rgba(181,68,46,0.4)", borderRadius: 2, marginRight: 5 }} />borrowed</span>
        <span><i style={{ display: "inline-block", width: 9, height: 9, background: "rgba(79,122,61,0.3)", border: "1px solid var(--green)", borderRadius: 2, marginRight: 5 }} />your pick</span>
      </div>
    </div>
  );
}

/* ---------- tool card ---------- */
function ToolCard({ tool, bookings, onOpen }) {
  const free = isToolFreeOn(tool.id, toKey(today()), bookings);
  const na = free ? null : nextAvailable(tool.id, bookings);
  return (
    <button onClick={() => onOpen(tool)} style={{ all: "unset", cursor: "pointer" }}>
      <div className="tag-card">
        <div className="tag-hole" />
        {tool.photoUrl && <img src={tool.photoUrl} alt={tool.name} className="tag-photo" />}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {!tool.photoUrl && (
            <div style={{ background: "var(--green)", color: "var(--bg-card)", borderRadius: 8, padding: 8, flexShrink: 0 }}>
              <Icon name={CAT_ICON[tool.category]} size={18} />
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16.5, color: "var(--ink)", lineHeight: 1.15 }}>{tool.name}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-soft)", marginTop: 3 }}>
              {catMeta(tool.category).label.toUpperCase()}{tool.brand ? ` · ${tool.brand.toUpperCase()}` : ""}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 5 }}>
          <Icon name="mapPin" size={12} /> {tool.ownerName}
        </div>
        <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "var(--font-mono)", padding: "4px 9px", borderRadius: 999, background: free ? "rgba(79,122,61,0.15)" : "rgba(181,68,46,0.13)", color: free ? "var(--green-dark)" : "var(--rust)" }}>
          <Icon name="clock" size={11} /> {free ? "Free today" : `Back ${fmtShort(na)}`}
        </div>
      </div>
    </button>
  );
}

/* ---------- auth screen ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [form, setForm] = useState({ name: "", address: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (mode === "forgot") {
        await api("/auth/forgot", { method: "POST", body: { email: form.email } });
        setNotice("If that email has an account, a reset link is on its way — check your inbox (and spam folder).");
      } else {
        const { user } = await api(mode === "login" ? "/auth/login" : "/auth/signup", {
          method: "POST",
          body: mode === "login" ? { email: form.email, password: form.password } : form,
        });
        onAuthed(user);
      }
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const canGo = mode === "forgot" ? EMAIL_RE.test(form.email)
    : mode === "login" ? form.email && form.password
    : form.name && form.address && EMAIL_RE.test(form.email) && form.password.length >= 8;

  return (
    <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 1.5, color: "var(--amber-dark)", marginBottom: 8 }}>PEAR CLOSE · PILOT</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 34, color: "var(--ink)", margin: 0, lineHeight: 1.05 }}>Pear Close<br />Toolbox</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 15, lineHeight: 1.5, marginTop: 12 }}>
          {mode === "login" && "Sign in to browse and reserve."}
          {mode === "signup" && "Create an account so owners can email you, and you can email them, when something's reserved."}
          {mode === "forgot" && "Enter your email and we'll send a link to set a new password."}
        </p>
        {notice ? (
          <div style={{ marginTop: 20, fontSize: 13.5, color: "var(--green-dark)", background: "rgba(79,122,61,0.12)", borderRadius: 8, padding: "12px 14px", lineHeight: 1.5 }}>{notice}</div>
        ) : (
          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            {mode === "signup" && <>
              <input placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
              <input placeholder="House number, e.g. 9 Pear Close" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} />
            </>}
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
            {form.email && !EMAIL_RE.test(form.email) && <div style={{ fontSize: 12, color: "var(--rust)" }}>That doesn't look like a full email address (needs an @ and a domain, like you@gmail.com).</div>}
            {mode !== "forgot" && (
              <input type="password" placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inputStyle} onKeyDown={(e) => e.key === "Enter" && canGo && submit()} />
            )}
            {err && <div style={{ fontSize: 12.5, color: "var(--rust)", display: "flex", gap: 6, alignItems: "center" }}><Icon name="alertTriangle" size={13} />{err}</div>}
            <button disabled={!canGo || busy} onClick={submit} style={{ ...primaryBtnStyle, opacity: canGo && !busy ? 1 : 0.5, cursor: canGo && !busy ? "pointer" : "not-allowed", marginTop: 4 }}>
              {busy ? "One sec…" : mode === "login" ? "Sign in →" : mode === "signup" ? "Create account →" : "Send reset link →"}
            </button>
            {mode === "login" && (
              <button onClick={() => { setMode("forgot"); setErr(""); }} style={{ all: "unset", cursor: "pointer", fontSize: 12.5, color: "var(--ink-soft)", textAlign: "center", padding: "4px 0" }}>Forgot your password?</button>
            )}
          </div>
        )}
        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); setNotice(""); }} style={{ ...ghostBtnStyle, marginTop: 14, width: "100%" }}>
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
        {mode !== "forgot" && <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 16, opacity: 0.8 }}>Your email is only used to notify you when a neighbor reserves one of your tools.</p>}
      </div>
    </div>
  );
}

/* ---------- reset password screen (reached via emailed link) ---------- */
function ResetPasswordScreen({ token, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const canGo = password.length >= 8 && password === confirm;

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const { user } = await api("/auth/reset", { method: "POST", body: { token, password } });
      onDone(user);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 1.5, color: "var(--amber-dark)", marginBottom: 8 }}>PEAR CLOSE · PILOT</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, color: "var(--ink)", margin: 0 }}>Set a new password</h1>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="password" placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          <input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} onKeyDown={(e) => e.key === "Enter" && canGo && submit()} />
          {confirm && password !== confirm && <div style={{ fontSize: 12.5, color: "var(--rust)" }}>Passwords don't match yet.</div>}
          {err && <div style={{ fontSize: 12.5, color: "var(--rust)", display: "flex", gap: 6, alignItems: "center" }}><Icon name="alertTriangle" size={13} />{err}</div>}
          <button disabled={!canGo || busy} onClick={submit} style={{ ...primaryBtnStyle, opacity: canGo && !busy ? 1 : 0.5, cursor: canGo && !busy ? "pointer" : "not-allowed", marginTop: 4 }}>
            {busy ? "One sec…" : "Set password and sign in →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- add tool ---------- */
const POWER_TYPES = ["", "Corded", "Cordless", "Manual / N/A"];

function PhotoPicker({ preview, onFile, onClear, busy }) {
  return (
    <div>
      {preview ? (
        <div style={{ position: "relative", width: "100%", maxWidth: 260 }}>
          <img src={preview} alt="Tool preview" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--line)", display: "block", aspectRatio: "4/3", objectFit: "cover" }} />
          <button type="button" onClick={onClear} style={{ ...iconBtnStyle, position: "absolute", top: 6, right: 6, background: "rgba(251,248,240,0.9)" }} className="icon-btn"><Icon name="x" size={14} /></button>
        </div>
      ) : (
        <label style={{ ...ghostBtnStyle, display: "inline-flex", alignItems: "center", gap: 8, cursor: busy ? "wait" : "pointer" }}>
          <Icon name="camera" size={14} />
          {busy ? "Processing…" : "Add a photo"}
          <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} style={{ display: "none" }} disabled={busy} />
        </label>
      )}
    </div>
  );
}

function AddTool({ onAdd, onDone, onPhotoUpdated, adminUsers, currentUserId }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("power");
  const [condition, setCondition] = useState(CONDITIONS[1]);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [powerType, setPowerType] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState(currentUserId || "");
  const [photoBlob, setPhotoBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const canSave = name.trim() && !busy;

  const handleFile = async (file) => {
    setErr(""); setPhotoBusy(true);
    try {
      const blob = await compressImage(file);
      setPhotoBlob(blob);
      setPreview(URL.createObjectURL(blob));
    } catch (e) { setErr(e.message); }
    setPhotoBusy(false);
  };
  const clearPhoto = () => { setPhotoBlob(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); };

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const tool = await onAdd({ name: name.trim(), category, condition, description: description.trim(), brand: brand.trim(), model: model.trim(), powerType, serialNumber: serialNumber.trim(), ownerId: ownerId || undefined });
      if (photoBlob && tool?.id) { const photoUrl = await uploadPhoto(tool.id, photoBlob); onPhotoUpdated && onPhotoUpdated(tool.id, photoUrl); }
      setName(""); setDescription(""); setCondition(CONDITIONS[1]); setCategory("power");
      setBrand(""); setModel(""); setPowerType(""); setSerialNumber(""); clearPhoto();
      onDone && onDone();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={sectionTitleStyle}>Add a tool to the shelf</h2>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, marginTop: -6, marginBottom: 18 }}>Anything sitting in your garage that a neighbor could borrow instead of buying their own.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={labelStyle}>Photo
          <PhotoPicker preview={preview} onFile={handleFile} onClear={clearPhoto} busy={photoBusy} />
        </label>
        {adminUsers && adminUsers.length > 0 && (
          <label style={labelStyle}>List this on behalf of
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
              {adminUsers.map((u) => <option key={u.id} value={u.id}>{u.id === currentUserId ? `Myself (${u.name})` : `${u.name} · ${u.address}`}</option>)}
            </select>
          </label>
        )}
        <label style={labelStyle}>Tool name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pressure Washer" style={inputStyle} />
        </label>
        <label style={labelStyle}>Category
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCategory(c.id)} style={{ ...chipStyle, ...(category === c.id ? chipActiveStyle : {}) }}>
                <Icon name={CAT_ICON[c.id]} size={13} /> {c.label}
              </button>
            ))}
          </div>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={labelStyle}>Brand
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. DeWalt" style={inputStyle} />
          </label>
          <label style={labelStyle}>Model
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. DCD771C2" style={inputStyle} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={labelStyle}>Power
            <select value={powerType} onChange={(e) => setPowerType(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
              {POWER_TYPES.map((p) => <option key={p} value={p}>{p || "Not specified"}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Serial number
            <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="Optional" style={inputStyle} />
          </label>
        </div>
        <label style={labelStyle}>Condition
          <select value={condition} onChange={(e) => setCondition(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Notes for borrowers (optional)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Accessories included, quirks, how to start it…" style={{ ...inputStyle, resize: "vertical", marginTop: 4 }} />
        </label>
        {err && <div style={{ fontSize: 12.5, color: "var(--rust)", display: "flex", gap: 6, alignItems: "center" }}><Icon name="alertTriangle" size={13} />{err}</div>}
        <button disabled={!canSave} onClick={submit} style={{ ...primaryBtnStyle, opacity: canSave ? 1 : 0.5, cursor: canSave ? "pointer" : "not-allowed", marginTop: 4 }}>
          <Icon name="plus" size={15} style={{ verticalAlign: -3, marginRight: 6 }} />{busy ? "Adding…" : "Add to the shelf"}
        </button>
      </div>
    </div>
  );
}

/* ---------- tool detail / booking ---------- */
function ToolDetail({ tool, bookings, onClose, onReserve, onDelete, onPhotoUpdated, onEdited, isAdmin }) {
  const [selRange, setSelRange] = useState({ start: null, end: null });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: tool.name, category: tool.category, condition: tool.condition, description: tool.description,
    brand: tool.brand, model: tool.model, powerType: tool.powerType, serialNumber: tool.serialNumber,
  });
  const [editErr, setEditErr] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const canManage = tool.isMine || isAdmin;
  const na = isToolFreeOn(tool.id, toKey(today()), bookings) ? null : nextAvailable(tool.id, bookings);

  const details = [
    ["Brand", tool.brand], ["Model", tool.model],
    ["Power", tool.powerType], ["Serial #", tool.serialNumber],
  ].filter(([, v]) => v);

  const saveEdit = async () => {
    if (!editForm.name.trim()) { setEditErr("Tool name can't be empty."); return; }
    setEditBusy(true); setEditErr("");
    try {
      const updated = await onEdited(tool.id, editForm);
      setEditing(false);
    } catch (e) { setEditErr(e.message); }
    setEditBusy(false);
  };

  const replacePhoto = async (file) => {
    setPhotoBusy(true); setError("");
    try {
      const blob = await compressImage(file);
      const photoUrl = await uploadPhoto(tool.id, blob);
      onPhotoUpdated(tool.id, photoUrl);
    } catch (e) { setError(e.message); }
    setPhotoBusy(false);
  };

  const pick = (key) => {
    setError("");
    if (!selRange.start || selRange.end) { setSelRange({ start: key, end: null }); return; }
    if (key < selRange.start) { setSelRange({ start: key, end: null }); return; }
    if (!isToolFreeRange(tool.id, selRange.start, key, bookings)) { setError("That range crosses a date someone else already has."); return; }
    setSelRange({ start: selRange.start, end: key });
  };

  const canReserve = selRange.start && selRange.end && agree && !busy;
  const submit = async () => {
    if (!canReserve) return;
    setBusy(true); setError("");
    try {
      await onReserve({ toolId: tool.id, start: selRange.start, end: selRange.end });
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const upcoming = bookedRangesFor(tool.id, bookings).filter((b) => b.end >= toKey(today())).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,18,10,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="modal-sheet" style={{ background: "var(--bg-card)", width: "100%", maxWidth: 640, maxHeight: "92vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 24, boxShadow: "0 -8px 30px rgba(0,0,0,0.25)" }}>
        {tool.photoUrl && (
          <div style={{ margin: "-24px -24px 16px", position: "relative", background: "var(--bg)" }}>
            <img src={tool.photoUrl} alt={tool.name} style={{ width: "100%", maxHeight: 320, objectFit: "contain", display: "block" }} />
            <button onClick={onClose} style={{ ...iconBtnStyle, position: "absolute", top: 12, right: 12, background: "rgba(251,248,240,0.9)" }}><Icon name="x" size={16} /></button>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {!tool.photoUrl && (
              <div style={{ background: "var(--green)", color: "#fff", borderRadius: 9, padding: 10, height: "fit-content" }}>
                <Icon name={CAT_ICON[tool.category]} size={20} />
              </div>
            )}
            <div>
              {!editing ? (
                <h2 style={{ ...sectionTitleStyle, fontSize: 22 }}>{tool.name}</h2>
              ) : (
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ ...inputStyle, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, padding: "8px 10px" }} />
              )}
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>{catMeta(tool.category).label} · {tool.condition} · owned by {tool.ownerName}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {canManage && !editing && (
              <button onClick={() => setEditing(true)} style={iconBtnStyle} title="Edit details"><Icon name="pencil" size={15} /></button>
            )}
            {!tool.photoUrl && <button onClick={onClose} style={iconBtnStyle}><Icon name="x" size={16} /></button>}
          </div>
        </div>

        {editing ? (
          <div style={{ marginTop: 14, background: "var(--bg)", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={labelStyle}>Category
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {CATEGORIES.map((c) => (
                  <button key={c.id} onClick={() => setEditForm({ ...editForm, category: c.id })} style={{ ...chipStyle, ...(editForm.category === c.id ? chipActiveStyle : {}) }}>
                    <Icon name={CAT_ICON[c.id]} size={13} /> {c.label}
                  </button>
                ))}
              </div>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={labelStyle}>Brand
                <input value={editForm.brand} onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })} style={inputStyle} />
              </label>
              <label style={labelStyle}>Model
                <input value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} style={inputStyle} />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={labelStyle}>Power
                <select value={editForm.powerType} onChange={(e) => setEditForm({ ...editForm, powerType: e.target.value })} style={{ ...inputStyle, marginTop: 4 }}>
                  {POWER_TYPES.map((p) => <option key={p} value={p}>{p || "Not specified"}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Serial number
                <input value={editForm.serialNumber} onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })} style={inputStyle} />
              </label>
            </div>
            <label style={labelStyle}>Condition
              <select value={editForm.condition} onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })} style={{ ...inputStyle, marginTop: 4 }}>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={labelStyle}>Notes for borrowers
              <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical", marginTop: 4 }} />
            </label>
            {editErr && <div style={{ fontSize: 12.5, color: "var(--rust)", display: "flex", gap: 6, alignItems: "center" }}><Icon name="alertTriangle" size={13} />{editErr}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={editBusy} onClick={saveEdit} style={{ ...primaryBtnStyle, padding: "9px 16px" }}>{editBusy ? "Saving…" : "Save changes"}</button>
              <button onClick={() => { setEditing(false); setEditErr(""); setEditForm({ name: tool.name, category: tool.category, condition: tool.condition, description: tool.description, brand: tool.brand, model: tool.model, powerType: tool.powerType, serialNumber: tool.serialNumber }); }} style={{ ...ghostBtnStyle, padding: "9px 16px" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {details.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginTop: 14 }}>
                {details.map(([label, value]) => (
                  <div key={label} style={{ background: "var(--bg)", borderRadius: 8, padding: "8px 11px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-soft)" }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
            {tool.description && <p style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.5, marginTop: 14, background: "var(--bg)", padding: "10px 13px", borderRadius: 8 }}>{tool.description}</p>}
          </>
        )}

        <div style={{ marginTop: 16, fontSize: 13, fontFamily: "var(--font-mono)", color: na ? "var(--rust)" : "var(--green-dark)" }}>
          {na ? `Next free: ${fmtLong(na)}` : "Free to grab right now"}
        </div>

        {upcoming.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--ink-soft)", marginBottom: 6 }}>UPCOMING RESERVATIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {upcoming.map((b) => (
                <div key={b.id} style={{ fontSize: 12.5, display: "flex", justifyContent: "space-between", background: "var(--bg)", borderRadius: 7, padding: "6px 10px" }}>
                  <span>{fmtShort(b.start)} – {fmtShort(b.end)}</span>
                  <span style={{ color: "var(--ink-soft)" }}>{b.borrowerName.split("·")[0].trim()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Reserve it</div>
          <MonthCalendar toolId={tool.id} bookings={bookings} selRange={selRange} onPick={pick} />
          {error && <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--rust)", display: "flex", gap: 6, alignItems: "center" }}><Icon name="alertTriangle" size={13} />{error}</div>}
          {selRange.start && (
            <div style={{ marginTop: 12, fontSize: 13.5, fontFamily: "var(--font-mono)" }}>
              Picked: {fmtShort(selRange.start)} {selRange.end ? `→ ${fmtShort(selRange.end)}` : "→ pick your return date"}
            </div>
          )}
          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12.5, color: "var(--ink-soft)", marginTop: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2 }} />
            I'll return it clean, on time, and I'll replace it if it breaks or goes missing on my watch.
          </label>
          <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 8 }}>The owner gets an email the moment you reserve — no need to message them separately.</div>
          <button disabled={!canReserve} onClick={submit} style={{ ...primaryBtnStyle, marginTop: 14, width: "100%", opacity: canReserve ? 1 : 0.5, cursor: canReserve ? "pointer" : "not-allowed" }}>
            {busy ? "Reserving…" : `Reserve ${selRange.start && selRange.end ? `${fmtShort(selRange.start)} – ${fmtShort(selRange.end)}` : ""}`}
          </button>
        </div>

        {canManage && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <label style={{ ...ghostBtnStyle, display: "inline-flex", alignItems: "center", gap: 8, cursor: photoBusy ? "wait" : "pointer" }}>
              <Icon name="camera" size={13} />{photoBusy ? "Uploading…" : tool.photoUrl ? "Replace photo" : "Add a photo"}
              <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files[0] && replacePhoto(e.target.files[0])} style={{ display: "none" }} disabled={photoBusy} />
            </label>
            <button onClick={() => { onDelete(tool.id); onClose(); }} style={{ ...ghostBtnStyle, color: "var(--rust)", borderColor: "var(--rust)", display: "flex", gap: 6, alignItems: "center" }}>
              <Icon name="trash" size={13} /> Remove from shelf
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- guidelines ---------- */
function Guidelines() {
  const rules = [
    ["Ask before you swing by", "Reserve it here first — the calendar is the only record we've all agreed to trust."],
    ["Return it clean, on the date you picked", "If plans change, come back and adjust your reservation so the next neighbor isn't stuck waiting."],
    ["Broke it? Replace it", "If a tool is damaged or goes missing while it's checked out to you, you're responsible for replacing it — same condition or better."],
    ["Flag problems honestly", "If a tool arrives already worn or broken, message the owner before you use it. Nobody gets blamed for damage they didn't cause."],
  ];
  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={sectionTitleStyle}>How the shelf works</h2>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, marginTop: -4, marginBottom: 18 }}>Four rules, same spirit as lending a ladder over the fence.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rules.map(([t, d], i) => (
          <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", display: "flex", gap: 14 }}>
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--amber-dark)", fontWeight: 600, fontSize: 13 }}>{pad(i + 1)}</div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>{t}</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 3, lineHeight: 1.5 }}>{d}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, fontSize: 12, color: "var(--ink-soft)", display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Icon name="info" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>This started as a Pear Close pilot. If it holds up here, the same shelf — under a different name — is built to spin up for any street that wants one.</span>
      </div>
    </div>
  );
}

function AccountSettings({ user, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(user.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const looksBad = !EMAIL_RE.test(user.email || "");
  const canSave = EMAIL_RE.test(email) && currentPassword && !busy;

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      const { user: updated } = await api("/me/email", { method: "PATCH", body: { newEmail: email, currentPassword } });
      onUpdated(updated);
      setNotice("Email updated."); setEditing(false); setCurrentPassword("");
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div>
      <h2 style={sectionTitleStyle}>Account</h2>
      {looksBad && !editing && (
        <div style={{ fontSize: 13, color: "var(--rust)", background: "rgba(181,68,46,0.1)", borderRadius: 8, padding: "10px 13px", marginTop: 8, marginBottom: 4, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <Icon name="alertTriangle" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>"{user.email}" doesn't look like a real email address — you won't get reservation notifications until this is fixed.</span>
        </div>
      )}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", marginTop: 8, maxWidth: 420 }}>
        {!editing ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 14 }}>{user.email || <em style={{ color: "var(--ink-soft)" }}>no email on file</em>}</div>
            <button onClick={() => { setEditing(true); setNotice(""); }} style={{ ...ghostBtnStyle, padding: "6px 12px", flexShrink: 0 }}>Change</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={labelStyle}>New email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>Current password (to confirm it's you)
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={inputStyle} />
            </label>
            {err && <div style={{ fontSize: 12.5, color: "var(--rust)", display: "flex", gap: 6, alignItems: "center" }}><Icon name="alertTriangle" size={13} />{err}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={!canSave} onClick={save} style={{ ...primaryBtnStyle, padding: "9px 16px", opacity: canSave ? 1 : 0.5, cursor: canSave ? "pointer" : "not-allowed" }}>{busy ? "Saving…" : "Save"}</button>
              <button onClick={() => { setEditing(false); setEmail(user.email || ""); setErr(""); }} style={{ ...ghostBtnStyle, padding: "9px 16px" }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      {notice && <div style={{ fontSize: 12.5, color: "var(--green-dark)", marginTop: 8 }}>{notice}</div>}
    </div>
  );
}

/* ---------- admin panel ---------- */
function AdminPanel({ adminUsers, tools, currentUserId, onCreateAccount, onResetPassword, onToggleAdmin, onDeleteAccount, onDeleteTool }) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tempPasswordFor, setTempPasswordFor] = useState(null); // { name, password }

  const canCreate = form.name && form.address && EMAIL_RE.test(form.email) && form.password.length >= 8;

  const createAccount = async () => {
    setErr(""); setBusy(true);
    try {
      await onCreateAccount(form);
      setForm({ name: "", address: "", email: "", password: "" }); setShowCreate(false);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const resetPw = async (u) => {
    try { const tempPassword = await onResetPassword(u.id); setTempPasswordFor({ name: u.name, password: tempPassword }); }
    catch (e) { setErr(e.message); }
  };

  const removeAccount = async (u) => {
    if (!window.confirm(`Remove ${u.name}'s account? This also deletes ${u.toolCount} tool(s) they listed and any bookings tied to them. This can't be undone.`)) return;
    try { await onDeleteAccount(u.id); } catch (e) { setErr(e.message); }
  };

  const removeTool = async (t) => {
    if (!window.confirm(`Remove "${t.name}" from the shelf? This can't be undone.`)) return;
    try { await onDeleteTool(t.id); } catch (e) { setErr(e.message); }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={sectionTitleStyle}>Admin</h2>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, marginTop: -4, marginBottom: 18 }}>Manage accounts and listings for the street.</p>

      {err && <div style={{ fontSize: 12.5, color: "var(--rust)", display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}><Icon name="alertTriangle" size={13} />{err}</div>}

      {tempPasswordFor && (
        <div style={{ background: "rgba(224,149,46,0.15)", border: "1px solid var(--amber)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13.5 }}>
          Temporary password for <strong>{tempPasswordFor.name}</strong>: <span style={{ fontFamily: "var(--font-mono)", background: "var(--bg-card)", padding: "2px 6px", borderRadius: 4 }}>{tempPasswordFor.password}</span>
          <div style={{ marginTop: 6, color: "var(--ink-soft)" }}>Share this with them directly — it won't be shown again. They can change it themselves once signed in.</div>
          <button onClick={() => setTempPasswordFor(null)} style={{ ...ghostBtnStyle, padding: "5px 10px", marginTop: 8 }}>Dismiss</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>Accounts ({adminUsers.length})</div>
        <button onClick={() => setShowCreate(!showCreate)} style={{ ...ghostBtnStyle, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="plus" size={13} />Create account</button>
      </div>

      {showCreate && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            <input placeholder="House number" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} />
          </div>
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
          <input type="password" placeholder="Initial password (8+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inputStyle} />
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={!canCreate || busy} onClick={createAccount} style={{ ...primaryBtnStyle, padding: "9px 16px", opacity: canCreate ? 1 : 0.5, cursor: canCreate ? "pointer" : "not-allowed" }}>{busy ? "Creating…" : "Create"}</button>
            <button onClick={() => setShowCreate(false)} style={{ ...ghostBtnStyle, padding: "9px 16px" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {adminUsers.map((u) => (
          <div key={u.id} style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 9, padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14 }}>
                {u.name} {u.isAdmin && <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--amber-dark)", marginLeft: 4 }}>ADMIN</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{u.address} · {u.email} · {u.toolCount} tool{u.toolCount === 1 ? "" : "s"}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => resetPw(u)} style={{ ...ghostBtnStyle, padding: "6px 10px", fontSize: 12.5 }}>Reset password</button>
              {u.id !== currentUserId && (
                <button onClick={() => onToggleAdmin(u.id, !u.isAdmin)} style={{ ...ghostBtnStyle, padding: "6px 10px", fontSize: 12.5 }}>{u.isAdmin ? "Revoke admin" : "Make admin"}</button>
              )}
              {u.id !== currentUserId && (
                <button onClick={() => removeAccount(u)} style={{ ...ghostBtnStyle, padding: "6px 10px", fontSize: 12.5, color: "var(--rust)", borderColor: "var(--rust)" }}>Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, marginTop: 28, marginBottom: 8 }}>All tools ({tools.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tools.map((t) => (
          <div key={t.id} style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 9, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 13.5 }}>{t.name} <span style={{ color: "var(--ink-soft)" }}>— {t.ownerName}</span></div>
            <button onClick={() => removeTool(t)} style={{ ...ghostBtnStyle, padding: "5px 10px", fontSize: 12, color: "var(--rust)", borderColor: "var(--rust)" }}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function bookingStatus(b) {
  if (b.returnedAt) return "returned";
  const t = toKey(today());
  if (b.end < t) return "overdue";
  if (b.start <= t) return "active";
  return "upcoming";
}
const STATUS_META = {
  upcoming: { label: "Upcoming", color: "var(--ink-soft)" },
  active: { label: "Checked out", color: "var(--amber-dark)" },
  overdue: { label: "Overdue", color: "var(--rust)" },
  returned: { label: "Returned", color: "var(--green-dark)" },
};

function BookingRow({ booking, toolName, otherPartyLabel, onCancel, onCheckin }) {
  const status = bookingStatus(booking);
  const meta = STATUS_META[status];
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 9, padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", opacity: status === "returned" ? 0.6 : 1 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5 }}>{toolName}</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)", fontFamily: "var(--font-mono)" }}>{fmtShort(booking.start)} – {fmtShort(booking.end)}{otherPartyLabel ? ` · ${otherPartyLabel}` : ""}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: meta.color }}>{meta.label}</span>
        {status === "upcoming" && onCancel && booking.canCheckin && <button onClick={() => onCancel(booking.id)} style={{ ...ghostBtnStyle, padding: "6px 11px" }}>Cancel</button>}
        {(status === "active" || status === "overdue") && onCheckin && booking.canCheckin && (
          <button onClick={() => onCheckin(booking.id)} style={{ ...ghostBtnStyle, padding: "6px 11px", ...(status === "overdue" ? { color: "var(--rust)", borderColor: "var(--rust)" } : {}) }}>Mark returned</button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ border: "1px dashed var(--line)", borderRadius: 10, padding: "26px 16px", textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>{text}</div>;
}

/* ---------- main app ---------- */
function VersionBadge({ version }) {
  if (!version) return null;
  return (
    <div style={{ position: "fixed", bottom: 8, right: 10, fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--ink-soft)", opacity: 0.55, zIndex: 40, pointerEvents: "none" }}>
      build #{version.build} · {version.commit}
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [tools, setTools] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState("browse");
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [openTool, setOpenTool] = useState(null);
  const [version, setVersion] = useState(null);
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get("reset"));
  const [adminUsers, setAdminUsers] = useState([]);

  const loadAdminUsers = async () => {
    try { const { users } = await api("/admin/users"); setAdminUsers(users); } catch { /* not an admin, or not loaded yet */ }
  };

  useEffect(() => {
    fetch("/api/version").then((r) => r.json()).then(setVersion).catch(() => {});
  }, []);

  const loadData = async () => {
    const [t, b] = await Promise.all([api("/tools"), api("/bookings")]);
    setTools(t.tools); setBookings(b.bookings);
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await api("/me");
        setUser(me.user);
        await loadData();
        if (me.user.isAdmin) await loadAdminUsers();
      } catch { setUser(null); }
      setLoading(false);
    })();
  }, []);

  const onAuthed = async (u) => { setUser(u); await loadData(); if (u.isAdmin) await loadAdminUsers(); };
  const onResetDone = async (u) => {
    window.history.replaceState({}, "", window.location.pathname); // scrub the token out of the URL
    setUser(u); await loadData(); if (u.isAdmin) await loadAdminUsers();
  };
  const signOut = async () => { await api("/auth/logout", { method: "POST" }); setUser(null); setTools([]); setBookings([]); setAdminUsers([]); };

  const addTool = async (payload) => { const { tool } = await api("/tools", { method: "POST", body: payload }); setTools((prev) => [tool, ...prev]); return tool; };
  const editTool = async (toolId, payload) => { const { tool } = await api(`/tools/${toolId}`, { method: "PATCH", body: payload }); setTools((prev) => prev.map((t) => (t.id === toolId ? tool : t))); setOpenTool((prev) => (prev && prev.id === toolId ? tool : prev)); return tool; };
  const deleteTool = async (toolId) => { await api(`/tools/${toolId}`, { method: "DELETE" }); setTools((prev) => prev.filter((t) => t.id !== toolId)); };

  const adminCreateAccount = async (payload) => { const { user: created } = await api("/admin/users", { method: "POST", body: payload }); setAdminUsers((prev) => [...prev, created]); };
  const adminResetPassword = async (userId) => { const { tempPassword } = await api(`/admin/users/${userId}/reset-password`, { method: "POST" }); return tempPassword; };
  const adminToggleAdmin = async (userId, isAdminNext) => { await api(`/admin/users/${userId}/admin`, { method: "PATCH", body: { isAdmin: isAdminNext } }); setAdminUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isAdmin: isAdminNext } : u))); };
  const adminDeleteAccount = async (userId) => {
    await api(`/admin/users/${userId}`, { method: "DELETE" });
    setAdminUsers((prev) => prev.filter((u) => u.id !== userId));
    await loadData(); // tools/bookings owned by or booked from the removed account are gone server-side (cascade)
  };
  const addBooking = async (payload) => { const { booking } = await api("/bookings", { method: "POST", body: payload }); setBookings((prev) => [...prev, booking]); setOpenTool(null); };
  const cancelBooking = async (bookingId) => { await api(`/bookings/${bookingId}`, { method: "DELETE" }); setBookings((prev) => prev.filter((b) => b.id !== bookingId)); };
  const checkinBooking = async (bookingId) => { const { returnedAt } = await api(`/bookings/${bookingId}/checkin`, { method: "POST" }); setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, returnedAt } : b))); };
  const updateToolPhoto = (toolId, photoUrl) => {
    setTools((prev) => prev.map((t) => (t.id === toolId ? { ...t, photoUrl } : t)));
    setOpenTool((prev) => (prev && prev.id === toolId ? { ...prev, photoUrl } : prev));
  };

  const filteredTools = useMemo(() => tools.filter((t) => {
    if (catFilter !== "all" && t.category !== catFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !(t.description || "").toLowerCase().includes(q) && !catMeta(t.category).label.toLowerCase().includes(q)) return false;
    }
    if (dateFilter && !isToolFreeOn(t.id, dateFilter, bookings)) return false;
    return true;
  }), [tools, query, catFilter, dateFilter, bookings]);

  if (resetToken && !user) return <div style={shellStyle}><ResetPasswordScreen token={resetToken} onDone={onResetDone} /><VersionBadge version={version} /></div>;
  if (loading) return <div style={{ ...shellStyle, alignItems: "center", justifyContent: "center" }}><div style={{ color: "var(--ink-soft)", fontFamily: "var(--font-mono)", fontSize: 13 }}>opening the shed…</div><VersionBadge version={version} /></div>;
  if (!user) return <div style={shellStyle}><AuthScreen onAuthed={onAuthed} /><VersionBadge version={version} /></div>;

  const myTools = tools.filter((t) => t.isMine);
  const myBookings = bookings.filter((b) => b.isMine).sort((a, b) => a.start.localeCompare(b.start));
  const myToolIds = new Set(myTools.map((t) => t.id));
  const toolsOut = bookings.filter((b) => myToolIds.has(b.toolId) && !b.isMine).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div style={shellStyle}>
      <header className="app-header" style={{ borderBottom: "1px solid var(--line)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="hammer" size={17} style={{ color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--ink)", lineHeight: 1 }}>Pear Close Toolbox</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-soft)", letterSpacing: 0.5 }}>NEIGHBORHOOD PILOT</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 6 }}><Icon name="user" size={13} />{user.name}</div>
          <button onClick={signOut} style={{ ...ghostBtnStyle, display: "flex", alignItems: "center", gap: 6, padding: "7px 11px" }}><Icon name="logOut" size={13} />Sign out</button>
        </div>
      </header>

      <nav className="nav-scroll" style={{ display: "flex", gap: 6, padding: "12px 20px 0", borderBottom: "1px solid var(--line)", flexWrap: "nowrap" }}>
        {[["browse", "Browse"], ["mine", "My stuff"], ["add", "Add a tool"], ["guidelines", "Guidelines"], ...(user.isAdmin ? [["admin", "Admin"]] : [])].map(([tid, label]) => (
          <button key={tid} onClick={() => setTab(tid)} style={{
            all: "unset", cursor: "pointer", padding: "9px 14px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13.5,
            color: tab === tid ? "var(--green-dark)" : "var(--ink-soft)", borderBottom: tab === tid ? "2.5px solid var(--green)" : "2.5px solid transparent",
            whiteSpace: "nowrap", flexShrink: 0, position: "relative",
          }}>
            {label}
            {tid === "mine" && !EMAIL_RE.test(user.email || "") && (
              <span style={{ position: "absolute", top: 6, right: 2, width: 6, height: 6, borderRadius: "50%", background: "var(--rust)" }} />
            )}
          </button>
        ))}
      </nav>

      <main className="app-main" style={{ padding: 22, flex: 1 }}>
        {tab === "browse" && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ position: "relative", flex: "1 1 220px" }}>
                <Icon name="search" size={15} style={{ position: "absolute", left: 11, top: 12, color: "var(--ink-soft)" }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tools…" style={{ ...inputStyle, paddingLeft: 34 }} />
              </div>
              <div style={{ position: "relative" }}>
                <Icon name="calendar" size={15} style={{ position: "absolute", left: 11, top: 12, color: "var(--ink-soft)" }} />
                <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={{ ...inputStyle, paddingLeft: 34, width: "auto", minWidth: 150 }} />
              </div>
              {dateFilter && <button onClick={() => setDateFilter("")} style={ghostBtnStyle}>Clear date</button>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              <button onClick={() => setCatFilter("all")} style={{ ...chipStyle, ...(catFilter === "all" ? chipActiveStyle : {}) }}>All</button>
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => setCatFilter(c.id)} style={{ ...chipStyle, ...(catFilter === c.id ? chipActiveStyle : {}) }}>
                  <Icon name={CAT_ICON[c.id]} size={13} />{c.label}
                </button>
              ))}
            </div>
            {dateFilter && <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 12, fontFamily: "var(--font-mono)" }}>Showing what's free on {fmtLong(dateFilter)}</div>}
            {filteredTools.length === 0 ? (
              <EmptyState text={tools.length === 0 ? "The shelf is empty — add the first tool." : "Nothing matches. Try another search, category, or date."} />
            ) : (
              <div className="app-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
                {filteredTools.map((t) => <ToolCard key={t.id} tool={t} bookings={bookings} onOpen={setOpenTool} />)}
              </div>
            )}
          </>
        )}

        {tab === "add" && <AddTool onAdd={addTool} onDone={() => setTab("browse")} onPhotoUpdated={updateToolPhoto} adminUsers={user.isAdmin ? adminUsers : null} currentUserId={user.id} />}
        {tab === "guidelines" && <Guidelines />}
        {tab === "admin" && user.isAdmin && (
          <AdminPanel
            adminUsers={adminUsers}
            tools={tools}
            currentUserId={user.id}
            onCreateAccount={adminCreateAccount}
            onResetPassword={adminResetPassword}
            onToggleAdmin={adminToggleAdmin}
            onDeleteAccount={adminDeleteAccount}
            onDeleteTool={deleteTool}
          />
        )}

        {tab === "mine" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 640 }}>
            <AccountSettings user={user} onUpdated={setUser} />
            <div>
              <h2 style={sectionTitleStyle}>Tools you've listed</h2>
              {myTools.length === 0 ? <EmptyState text="You haven't added anything yet." /> : (
                <div className="app-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14, marginTop: 12 }}>
                  {myTools.map((t) => <ToolCard key={t.id} tool={t} bookings={bookings} onOpen={setOpenTool} />)}
                </div>
              )}
            </div>
            <div>
              <h2 style={sectionTitleStyle}>Your reservations</h2>
              {myBookings.length === 0 ? <EmptyState text="Nothing booked. Go find something on the shelf." /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {myBookings.map((b) => {
                    const t = tools.find((x) => x.id === b.toolId);
                    return <BookingRow key={b.id} booking={b} toolName={t ? t.name : "Removed tool"} otherPartyLabel={t ? t.ownerName.split("·")[0].trim() : ""} onCancel={cancelBooking} onCheckin={checkinBooking} />;
                  })}
                </div>
              )}
            </div>
            {toolsOut.length > 0 && (
              <div>
                <h2 style={sectionTitleStyle}>Tools out with neighbors</h2>
                <p style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: -4, marginBottom: 12 }}>Bookings on things you've listed. Mark returned once you've got it back.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {toolsOut.map((b) => {
                    const t = tools.find((x) => x.id === b.toolId);
                    return <BookingRow key={b.id} booking={b} toolName={t ? t.name : "Removed tool"} otherPartyLabel={b.borrowerName.split("·")[0].trim()} onCancel={cancelBooking} onCheckin={checkinBooking} />;
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {openTool && <ToolDetail tool={openTool} bookings={bookings} onClose={() => setOpenTool(null)} onReserve={addBooking} onDelete={deleteTool} onPhotoUpdated={updateToolPhoto} onEdited={editTool} isAdmin={user.isAdmin} />}
      <VersionBadge version={version} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
