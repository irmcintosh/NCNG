// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";

// --- Env & helpers -----------------------------------------------------------
function withSharingRest(u: string) {
  if (!u) return "https://www.arcgis.com/sharing/rest";
  const trimmed = u.replace(/\/+$/, "");
  return /\/sharing\/rest$/.test(trimmed) ? trimmed : trimmed + "/sharing/rest";
}

// Default to current fiscal year (FY##), assuming FY starts Oct 1
function getDefaultFiscalYear() {
  const today = new Date();
  const year = today.getFullYear();
  const fyYear = today.getMonth() >= 9 ? year + 1 : year; // Oct (9)–Dec → next year
  return `FY${String(fyYear).slice(-2)}`;
}

const grid2: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
};

const PORTAL_URL = withSharingRest(import.meta.env.VITE_PORTAL_URL || "https://www.arcgis.com/sharing/rest");
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || "";
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || `${window.location.origin}/`;
const TEMPLATE_OWNER = import.meta.env.VITE_TEMPLATE_OWNER || "";
const TEMPLATE_ITEMID = import.meta.env.VITE_TEMPLATE_ITEMID || "";

const STORAGE_KEY = "ncng_arcgis_session_v1";

// NCNG-[Portfolio]-[AGOL|PORTAL]-[Purpose]-[Owner]-[FY##?]
const TITLE_REGEX = /^NCNG-[A-Z0-9]+-(AGOL|PORTAL)-[A-Za-z][A-Za-z0-9]+-[A-Z0-9]+(?:-FY\d{2})?$/;

// normalize inputs
function toUpperAlnum(s: string) { return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function toPascalAlnum(s: string) {
  const pascal = (s || "")
    .split(/[^A-Za-z0-9]+/g).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return pascal.replace(/^[^A-Za-z]+/, "");
}
function buildTitle(pRaw: string, env: "AGOL" | "PORTAL", purpRaw: string, ownRaw: string, fy?: string) {
  const p = toUpperAlnum(pRaw);
  const purp = toPascalAlnum(purpRaw);
  const own = toUpperAlnum(ownRaw);
  const year = fy && /^FY\d{2}$/.test(fy) ? `-${fy}` : "";
  return `NCNG-${p}-${env}-${purp}-${own}${year}`;
}

// --- Styles ------------------------------------------------------------------
const shell: React.CSSProperties = { background: "#0f172a", color: "#e5e7eb", minHeight: "100vh", padding: 24 };
const card: React.CSSProperties = { background: "rgba(30,41,59,0.65)", border: "1px solid #334155", borderRadius: 16, padding: 20 };
const label: React.CSSProperties = { display: "block", fontSize: 13, marginBottom: 6, color: "#cbd5e1" };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #475569", background: "#fff", color: "#0f172a", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { padding: "10px 16px", borderRadius: 16, background: "#4f46e5", color: "#fff", border: "none", cursor: "pointer" };
const btnAction: React.CSSProperties = { padding: "10px 16px", borderRadius: 16, background: "#059669", color: "#fff", border: "none", cursor: "pointer" };
const hint: React.CSSProperties = { fontSize: 12, color: "#94a3b8", marginTop: 4 };

// --- Types -------------------------------------------------------------------
type ArcGISAuth = any;
type ArcGISRequest = any;
type Folder = { id: string; title: string };

// --- Component ---------------------------------------------------------------
export default function App() {
  const [auth, setAuth] = useState<ArcGISAuth | null>(null);
  const [me, setMe] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ newItemId: string; folderId?: string } | null>(null);

  // naming/metadata fields
  const [portfolioRaw, setPortfolioRaw] = useState("");
  const [purposeRaw, setPurposeRaw] = useState("");
  const [ownerRaw, setOwnerRaw] = useState("");
  const [environment, setEnvironment] = useState<"AGOL" | "PORTAL">("AGOL");
  const [fy, setFy] = useState(getDefaultFiscalYear());
  const [tags, setTags] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");

  // folder selection
  const [folders, setFolders] = useState<Folder[]>([]);
  const [useExistingFolder, setUseExistingFolder] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(""); // "" => Root
  const [newFolderTitle, setNewFolderTitle] = useState<string>("NCNG-AGOL-Maps");

  const title = useMemo(
    () => buildTitle(portfolioRaw, environment, purposeRaw, ownerRaw, fy),
    [portfolioRaw, environment, purposeRaw, ownerRaw, fy]
  );
  const titleValid = TITLE_REGEX.test(title);

  // ---------- Persistence helpers ----------
  async function restoreSessionFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const mod: any = await import("@esri/arcgis-rest-auth");
      const Identity = mod.ArcGISIdentityManager ?? mod.UserSession;
      const restoreFn = Identity.deserialize ?? Identity.fromJSON ?? null;
      if (!restoreFn) return null;
      const mgr = restoreFn.call(Identity, data);
      return mgr;
    } catch {
      return null;
    }
  }
  function saveSession(mgr: any) {
    try {
      const serialized = mgr.serialize?.() ?? mgr.toJSON?.();
      if (serialized) localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch {}
  }
  function clearSessionStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.clear();
    } catch {}
  }

  // ---------- Load folders for user ----------
  async function loadFolders(mgr: ArcGISAuth) {
    const { request } = await import("@esri/arcgis-rest-request") as { request: ArcGISRequest };
    const userContent = await request(`${PORTAL_URL}/content/users/${mgr.username}`, {
      params: { f: "json" },
      authentication: mgr
    });
    const list: Folder[] = (userContent?.folders || []).map((f: any) => ({ id: f.id, title: f.title }));
    setFolders(list);
    const preferred = list.find(f => f.title === "NCNG-AGOL-Maps");
    if (preferred) {
      setUseExistingFolder(true);
      setSelectedFolderId(preferred.id);
    }
  }

  // ---------- Complete OAuth / restore on load ----------
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const hasCode = url.searchParams.get("code");
        const hasToken = window.location.hash.includes("access_token=");

        if (hasCode || hasToken) {
          const mod: any = await import("@esri/arcgis-rest-auth");
          const Identity = mod.ArcGISIdentityManager ?? mod.UserSession;

          const mgr = await Identity.completeOAuth2({
            clientId: CLIENT_ID,
            redirectUri: REDIRECT_URI,
            portal: PORTAL_URL,
            responseType: hasToken ? "token" : "code"
          });

          setAuth(mgr as any);
          setMe((mgr as any).username || "");
          setError(null);
          saveSession(mgr);
          await loadFolders(mgr);

          window.history.replaceState({}, document.title, REDIRECT_URI);
          return;
        }

        const restored = await restoreSessionFromStorage();
        if (restored) {
          setAuth(restored as any);
          setMe((restored as any).username || "");
          setError(null);
          await loadFolders(restored);
        }
      } catch (e) {
        console.warn("OAuth completion/restore warning:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Start OAuth (implicit token) ----------
  async function signIn() {
    setError(null);
    try {
      const mod: any = await import("@esri/arcgis-rest-auth");
      const Identity = mod.ArcGISIdentityManager ?? mod.UserSession;
      await Identity.beginOAuth2({
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        portal: PORTAL_URL,
        popup: false,
        responseType: "token"
      });
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Sign-in failed");
    }
  }

  // ---------- Sign out (stay in the app) ----------
  async function signOut() {
    try { (auth as any)?.signOut?.(); } catch {}
    clearSessionStorage();
    setAuth(null);
    setMe("");
    // Optional: reset form fields
    setPortfolioRaw(""); setPurposeRaw(""); setOwnerRaw("");
    setTags(""); setSummary(""); setDescription("");
    setResult(null);
    // Keep FY default on sign-out
    setFy(getDefaultFiscalYear());
    window.location.href = REDIRECT_URI;
  }

  // ---------- Content helpers ----------
  async function createFolder(mgr: ArcGISAuth, title: string) {
    const { request } = await import("@esri/arcgis-rest-request") as { request: ArcGISRequest };
    const created = await request(`${PORTAL_URL}/content/users/${mgr.username}/createFolder`, {
      httpMethod: "POST",
      authentication: mgr,
      params: { title, f: "json" }
    });
    return created?.folder?.id as string;
  }

  async function copyTemplate(mgr: ArcGISAuth, folderId?: string) {
    const { request } = await import("@esri/arcgis-rest-request") as { request: ArcGISRequest };
    const params: any = {
      title,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean).join(","),
      includeResources: true,
      copyPrivateResources: true,
      f: "json"
    };
    if (folderId) params.folder = folderId; // omit for Root
    const resp = await request(
      `${PORTAL_URL}/content/users/${TEMPLATE_OWNER}/items/${TEMPLATE_ITEMID}/copy`,
      { httpMethod: "POST", authentication: mgr, params }
    );
    return (resp.itemId || resp.id) as string;
  }

  async function updateDetails(mgr: ArcGISAuth, newItemId: string, folderId?: string) {
    if (!summary.trim() && !description.trim()) return;
    const { request } = await import("@esri/arcgis-rest-request") as { request: ArcGISRequest };
    const params: Record<string, any> = { f: "json" };
    if (summary.trim()) params.snippet = summary.trim();
    if (description.trim()) params.description = description.trim();

    const path = folderId
      ? `${PORTAL_URL}/content/users/${me}/${folderId}/items/${newItemId}/update`
      : `${PORTAL_URL}/content/users/${me}/items/${newItemId}/update`;

    await request(path, { httpMethod: "POST", authentication: mgr, params });
  }

  // ---------- Submit ----------
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!auth) return setError("Please sign in first.");
    if (!titleValid) return setError("Title does not match the NCNG naming convention.");

    setBusy(true);
    try {
      let folderId: string | undefined = undefined;

      if (useExistingFolder) {
        folderId = selectedFolderId || undefined; // "" => Root
      } else {
        const trimmed = newFolderTitle.trim();
        if (!trimmed) throw new Error("Please enter a folder name.");
        folderId = await createFolder(auth, trimmed);
        setSelectedFolderId(folderId);
        await loadFolders(auth);
      }

      const newItemId = await copyTemplate(auth, folderId);
      await updateDetails(auth, newItemId, folderId);
      setResult({ newItemId, folderId });
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to save web map.");
    } finally {
      setBusy(false);
    }
  }

  // ---------- UI ----------
  return (
    <div style={shell}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <img
              src="https://files.nc.gov/nc-national-guard/NCNGLogo2022-FullColor01-250.png?VersionId=91VKWYn1EE1bRfwcrOuomskM66r46VsC"
              alt="NCNG Logo"
              style={{ height: 40 }}
            />
            <h1 style={{ fontSize: 24, fontWeight: 600 }}>NCNG Web Map Template Saver</h1>
          </div>

          {auth ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: 13, color: "#cbd5e1" }}>
                Signed in as <span style={{ fontFamily: "ui-monospace" }}>{me}</span>
              </span>
              <button
                onClick={signOut}
                style={{ padding: "6px 12px", borderRadius: 12, background: "#dc2626", color: "#fff", border: "none", cursor: "pointer", fontSize: 12 }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button style={btnPrimary} onClick={signIn}>Sign in to ArcGIS</button>
          )}
        </header>

        <form onSubmit={onSubmit} style={card}>
          {/* Naming */}
          <div style={grid2}>
            <div>
              <label style={label}>Portfolio/Mission (free text)</label>
              <input style={input} value={portfolioRaw} onChange={e => setPortfolioRaw(e.target.value)} placeholder="e.g., SAD, IEMAC, OPS" />
              <div style={hint}>Will normalize to <code>UPPERCASE</code> in the title.</div>
            </div>
            <div>
              <label style={label}>Environment</label>
              <select style={input} value={environment} onChange={e => setEnvironment(e.target.value as "AGOL" | "PORTAL")}>
                <option value="AGOL">AGOL</option>
                <option value="PORTAL">PORTAL</option>
              </select>
            </div>
            <div>
              <label style={label}>Purpose (free text)</label>
              <input style={input} value={purposeRaw} onChange={e => setPurposeRaw(e.target.value)} placeholder="e.g., Collaboration" />
              <div style={hint}>Will normalize to <code>PascalCase</code>.</div>
            </div>
            <div>
              <label style={label}>Owner (free text)</label>
              <input style={input} value={ownerRaw} onChange={e => setOwnerRaw(e.target.value)} placeholder="e.g., GEO, J3" />
              <div style={hint}>Will normalize to <code>UPPERCASE</code> in the title.</div>
            </div>
            <div>
              <label style={label}>Fiscal Year (defaulted)</label>
              <input style={input} value={fy} onChange={e => setFy(e.target.value.toUpperCase())} placeholder="FY25" />
              <div style={hint}>Defaults to current FY. Format: FY## (e.g., FY25).</div>
            </div>
          </div>

          {/* Title preview */}
          <div style={{ marginTop: 16 }}>
            <label style={label}>Resulting Title (auto)</label>
            <input style={{ ...input, fontFamily: "ui-monospace", color: titleValid ? "#0f172a" : "#b91c1c" }} value={title} readOnly />
            {!titleValid && (
              <div style={{ ...hint, color: "#fca5a5" }}>
                Must match: <code>NCNG-[Portfolio]-(AGOL|PORTAL)-[Purpose]-[Owner]-[FY##?]</code>
              </div>
            )}
          </div>

          {/* Folder section */}
          <div style={{ marginTop: 16 }}>
            <label style={{ ...label, marginBottom: 10 }}>Save to folder</label>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="radio" checked={useExistingFolder} onChange={() => setUseExistingFolder(true)} />
                <span>Use existing</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="radio" checked={!useExistingFolder} onChange={() => setUseExistingFolder(false)} />
                <span>Create new</span>
              </label>
            </div>

            {useExistingFolder ? (
              <div style={{ marginTop: 10 }}>
                <select
                  style={input}
                  value={selectedFolderId}
                  onChange={e => setSelectedFolderId(e.target.value)}
                  disabled={!auth}
                >
                  <option value="">Root (My Content)</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.title}</option>
                  ))}
                </select>
                <div style={hint}>Choose an existing folder, or pick Root to save at the top level.</div>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <input
                  style={input}
                  value={newFolderTitle}
                  onChange={e => setNewFolderTitle(e.target.value)}
                  placeholder="New folder name"
                />
                <div style={hint}>A folder with this name will be created in your content.</div>
              </div>
            )}
          </div>

          {/* Optional metadata */}
          <div style={{ ...grid2, marginTop: 16 }}>
            <div>
              <label style={label}>Tags (optional, comma-separated)</label>
              <input style={input} value={tags} onChange={e => setTags(e.target.value)} placeholder="NCNG, SAD, Collaboration" />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={label}>Summary (optional)</label>
            <input style={input} value={summary} onChange={e => setSummary(e.target.value)} />
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={label}>Description (optional)</label>
            <textarea style={{ ...input, height: 120 }} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {error && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "rgba(127,29,29,0.4)", border: "1px solid #7f1d1d", color: "#fecaca" }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
            <button type="submit" style={{ ...btnAction, opacity: !auth || busy || !titleValid ? 0.6 : 1 }} disabled={!auth || busy || !titleValid}>
              {busy ? "Saving…" : "Save My Copy"}
            </button>
            {!auth && <span style={hint}>Sign in to enable saving</span>}
          </div>

          {result && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "rgba(51,65,85,0.5)", border: "1px solid #475569" }}>
              <p>Done! Your web map was created.</p>
              <ul style={{ margin: "8px 0 0 18px" }}>
                <li>
                  Item:{" "}
                  <a
                    href={`https://www.arcgis.com/home/item.html?id=${result.newItemId}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#93c5fd" }}
                  >
                    View in AGOL
                  </a>
                </li>
              </ul>
            </div>
          )}
        </form>

        <footer style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
          Original template remains protected; this app only creates a personal copy.
        </footer>
      </div>
    </div>
  );
}
