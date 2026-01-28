import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE =
  process.env.REACT_APP_BACKEND_URL ||
  "http://localhost:3001";

/**
 * Minimal API client with JWT support.
 */
function useApi(token) {
  return useMemo(() => {
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    // PUBLIC_INTERFACE
    async function request(path, { method = "GET", body } = {}) {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 204) return null;

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.detail || "Request failed";
        throw new Error(msg);
      }
      return data;
    }

    return { request };
  }, [token]);
}

function RetroCard({ title, children, actions }) {
  return (
    <section className="card">
      <div className="cardHeader">
        <h2 className="cardTitle">{title}</h2>
        <div className="cardActions">{actions}</div>
      </div>
      <div className="cardBody">{children}</div>
    </section>
  );
}

function Input({ label, ...props }) {
  const id = props.id || `in_${label.replace(/\s+/g, "_").toLowerCase()}`;
  return (
    <label className="field" htmlFor={id}>
      <span className="fieldLabel">{label}</span>
      <input className="input" id={id} {...props} />
    </label>
  );
}

function TextArea({ label, ...props }) {
  const id = props.id || `ta_${label.replace(/\s+/g, "_").toLowerCase()}`;
  return (
    <label className="field" htmlFor={id}>
      <span className="fieldLabel">{label}</span>
      <textarea className="textarea" id={id} {...props} />
    </label>
  );
}

function Button({ variant = "primary", ...props }) {
  return <button className={`btn btn-${variant}`} {...props} />;
}

// PUBLIC_INTERFACE
function App() {
  const [theme, setTheme] = useState("light");

  const [token, setToken] = useState(() => localStorage.getItem("cm_token") || "");
  const api = useApi(token);

  const [authMode, setAuthMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [me, setMe] = useState(null);

  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState("");

  const [editing, setEditing] = useState(null); // contact or null
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });

  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Fetch current user + contacts when token changes
  useEffect(() => {
    if (!token) {
      setMe(null);
      setContacts([]);
      return;
    }

    let cancelled = false;
    async function boot() {
      try {
        setLoading(true);
        const meData = await api.request("/auth/me");
        if (!cancelled) setMe(meData);
        const list = await api.request(`/contacts?q=${encodeURIComponent(q)}`);
        if (!cancelled) setContacts(list);
      } catch (e) {
        if (!cancelled) {
          setStatus({ type: "error", message: e.message });
          // token might be invalid/expired
          doLogout();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Refetch contacts on search change (debounced)
  useEffect(() => {
    if (!token) return;

    const t = setTimeout(async () => {
      try {
        const list = await api.request(`/contacts?q=${encodeURIComponent(q)}`);
        setContacts(list);
      } catch (e) {
        setStatus({ type: "error", message: e.message });
      }
    }, 250);

    return () => clearTimeout(t);
  }, [q, token, api]);

  function setTokenPersist(nextToken) {
    setToken(nextToken);
    if (nextToken) localStorage.setItem("cm_token", nextToken);
    else localStorage.removeItem("cm_token");
  }

  // PUBLIC_INTERFACE
  function toggleTheme() {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }

  function setOk(msg) {
    setStatus({ type: "ok", message: msg });
    setTimeout(() => setStatus({ type: "idle", message: "" }), 2500);
  }

  function setErr(msg) {
    setStatus({ type: "error", message: msg });
  }

  async function submitAuth(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      if (!email.trim()) throw new Error("Email is required");
      if (!password || password.length < 8) throw new Error("Password must be at least 8 characters");

      const path = authMode === "register" ? "/auth/register" : "/auth/login";
      const data = await api.request(path, {
        method: "POST",
        body: { email: email.trim(), password },
      });

      setTokenPersist(data.access_token);
      setPassword("");
      setOk(authMode === "register" ? "Registered!" : "Logged in!");
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  }

  function doLogout() {
    setTokenPersist("");
    setEmail("");
    setPassword("");
    setQ("");
    setEditing(null);
    setForm({ name: "", phone: "", email: "", address: "" });
  }

  function startAdd() {
    setEditing({ id: null });
    setForm({ name: "", phone: "", email: "", address: "" });
    setStatus({ type: "idle", message: "" });
  }

  function startEdit(c) {
    setEditing(c);
    setForm({
      name: c.name || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
    });
    setStatus({ type: "idle", message: "" });
  }

  async function saveContact(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      if (!form.name.trim()) throw new Error("Name is required");

      if (editing?.id) {
        await api.request(`/contacts/${editing.id}`, {
          method: "PUT",
          body: {
            name: form.name.trim(),
            phone: form.phone || null,
            email: form.email || null,
            address: form.address || null,
          },
        });
        setOk("Contact updated");
      } else {
        await api.request("/contacts", {
          method: "POST",
          body: {
            name: form.name.trim(),
            phone: form.phone || null,
            email: form.email || null,
            address: form.address || null,
          },
        });
        setOk("Contact added");
      }

      const list = await api.request(`/contacts?q=${encodeURIComponent(q)}`);
      setContacts(list);
      setEditing(null);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteContact(c) {
    // eslint-disable-next-line no-restricted-globals
    const ok = window.confirm(`Delete "${c.name}"?`);
    if (!ok) return;

    setLoading(true);
    try {
      await api.request(`/contacts/${c.id}`, { method: "DELETE" });
      const list = await api.request(`/contacts?q=${encodeURIComponent(q)}`);
      setContacts(list);
      setOk("Deleted");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="App">
      <div className="appBg" />
      <header className="topbar">
        <div className="brand">
          <span className="brandMark">CM</span>
          <div className="brandText">
            <div className="brandTitle">Contact Manager</div>
            <div className="brandSubtitle">Retro desk organizer edition</div>
          </div>
        </div>

        <div className="topbarRight">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            type="button"
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>

          {token ? (
            <>
              <div className="userPill" title={me?.email || ""}>
                {me?.email || "Signed in"}
              </div>
              <Button variant="ghost" type="button" onClick={doLogout}>
                Logout
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <main className="layout">
        {!token ? (
          <RetroCard
            title={authMode === "register" ? "Create Account" : "Login"}
            actions={
              <Button
                variant="ghost"
                type="button"
                onClick={() => setAuthMode((m) => (m === "login" ? "register" : "login"))}
              >
                Switch to {authMode === "login" ? "Register" : "Login"}
              </Button>
            }
          >
            <form className="grid2" onSubmit={submitAuth}>
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                required
              />
              <Input
                label="Password"
                type="password"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min 8 characters"
                required
              />

              <div className="rowActions">
                <Button type="submit" disabled={loading}>
                  {loading ? "Working..." : authMode === "register" ? "Register" : "Login"}
                </Button>
              </div>

              {status.type === "error" ? <div className="alert alertError">{status.message}</div> : null}
            </form>

            <p className="hint">
              Backend: <code>{API_BASE}</code> (set <code>REACT_APP_BACKEND_URL</code> to override)
            </p>
          </RetroCard>
        ) : (
          <>
            <aside className="sidebar">
              <RetroCard
                title="Tools"
                actions={
                  <Button variant="secondary" type="button" onClick={startAdd} disabled={loading}>
                    + Add
                  </Button>
                }
              >
                <label className="field" htmlFor="search">
                  <span className="fieldLabel">Search</span>
                  <input
                    className="input"
                    id="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Type to search..."
                  />
                </label>

                {status.type === "ok" ? <div className="alert alertOk">{status.message}</div> : null}
                {status.type === "error" ? <div className="alert alertError">{status.message}</div> : null}

                <div className="meta">
                  <div>
                    <span className="metaKey">Contacts</span>
                    <span className="metaVal">{contacts.length}</span>
                  </div>
                  <div>
                    <span className="metaKey">Status</span>
                    <span className="metaVal">{loading ? "busy" : "ready"}</span>
                  </div>
                </div>
              </RetroCard>
            </aside>

            <section className="main">
              <RetroCard title="Contacts">
                {contacts.length === 0 ? (
                  <div className="empty">
                    No contacts yet. Click <strong>+ Add</strong> to create one.
                  </div>
                ) : (
                  <ul className="list" aria-label="Contact list">
                    {contacts.map((c) => (
                      <li key={c.id} className="listItem">
                        <div className="listMain">
                          <div className="listName">{c.name}</div>
                          <div className="listDetails">
                            {c.phone ? <span>☎ {c.phone}</span> : null}
                            {c.email ? <span>✉ {c.email}</span> : null}
                            {c.address ? <span>⌂ {c.address}</span> : null}
                          </div>
                        </div>
                        <div className="listActions">
                          <Button variant="ghost" type="button" onClick={() => startEdit(c)} disabled={loading}>
                            Edit
                          </Button>
                          <Button variant="danger" type="button" onClick={() => deleteContact(c)} disabled={loading}>
                            Delete
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </RetroCard>

              {editing ? (
                <RetroCard title={editing.id ? "Edit Contact" : "New Contact"}>
                  <form className="grid2" onSubmit={saveContact}>
                    <Input
                      label="Name"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Full name"
                      required
                    />
                    <Input
                      label="Phone"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+1 (555) 123-4567"
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="contact@domain.com"
                    />
                    <TextArea
                      label="Address"
                      value={form.address}
                      onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                      placeholder="Street, City, Country"
                      rows={3}
                    />

                    <div className="rowActions">
                      <Button type="submit" disabled={loading}>
                        {loading ? "Saving..." : "Save"}
                      </Button>
                      <Button variant="ghost" type="button" onClick={() => setEditing(null)} disabled={loading}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </RetroCard>
              ) : null}
            </section>
          </>
        )}
      </main>

      <footer className="footer">
        <span>Tip: search matches name, phone, email, and address.</span>
      </footer>
    </div>
  );
}

export default App;
