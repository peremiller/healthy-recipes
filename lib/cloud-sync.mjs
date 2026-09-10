const AUTH_STORAGE_KEY = "nourishplan.auth.v1";
const REFRESH_WINDOW_SECONDS = 90;

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeSession(value) {
  if (!value?.access_token || !value?.refresh_token || !value?.user?.id) return null;
  const expiresAt = Number(value.expires_at)
    || Math.floor(Date.now() / 1000) + Number(value.expires_in || 3600);
  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token,
    expires_at: expiresAt,
    user: {
      id: value.user.id,
      email: value.user.email || ""
    }
  };
}

export function createCloudSync({
  url,
  publishableKey,
  storage = window.localStorage,
  fetchImpl = typeof window.fetch === "function"
    ? window.fetch.bind(window)
    : async () => { throw new Error("Network access is unavailable"); },
  getLocalState,
  applyRemoteState,
  onStatus = () => {}
}) {
  let session = normalizeSession(safeJsonParse(storage.getItem(AUTH_STORAGE_KEY)));
  let revision = null;
  let dirty = false;
  let changeSerial = 0;
  let pushQueued = false;
  let saveTimer = null;
  let activeRequest = null;
  let initialized = false;
  let status = {
    phase: session ? "connecting" : "local",
    message: session ? "Connecting to cloud…" : "Saved on this device",
    email: session?.user.email || "",
    signedIn: Boolean(session),
    lastSyncedAt: null
  };
  const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

  function emit(patch) {
    status = { ...status, ...patch };
    onStatus({ ...status });
  }

  function persistSession(nextSession) {
    session = normalizeSession(nextSession);
    if (session) storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    else storage.removeItem(AUTH_STORAGE_KEY);
    emit({
      email: session?.user.email || "",
      signedIn: Boolean(session)
    });
  }

  async function request(path, { method = "GET", body, accessToken, prefer } = {}) {
    const headers = {
      apikey: publishableKey,
      Accept: "application/json"
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (prefer) headers.Prefer = prefer;
    const response = await fetchImpl(`${url}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    const data = text ? safeJsonParse(text, { message: text }) : null;
    if (!response.ok) {
      const error = new Error(data?.msg || data?.message || data?.error_description || `Cloud request failed (${response.status})`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  async function refreshSession() {
    if (!session?.refresh_token) return null;
    try {
      const data = await request("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: { refresh_token: session.refresh_token }
      });
      persistSession(data);
      return session;
    } catch (error) {
      persistSession(null);
      revision = null;
      emit({ phase: "local", message: "Session expired · saved on this device", lastSyncedAt: null });
      throw error;
    }
  }

  async function validSession() {
    if (!session) return null;
    const expiresSoon = session.expires_at <= Math.floor(Date.now() / 1000) + REFRESH_WINDOW_SECONDS;
    return expiresSoon ? refreshSession() : session;
  }

  async function fetchCloudRow() {
    const currentSession = await validSession();
    if (!currentSession) return null;
    const rows = await request(`/rest/v1/nourishplan_states?select=payload,revision,updated_at&user_id=eq.${encodeURIComponent(currentSession.user.id)}&limit=1`, {
      accessToken: currentSession.access_token
    });
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  async function insertCloudRow(payload) {
    const currentSession = await validSession();
    const rows = await request("/rest/v1/nourishplan_states?select=payload,revision,updated_at", {
      method: "POST",
      accessToken: currentSession.access_token,
      prefer: "return=representation",
      body: {
        user_id: currentSession.user.id,
        payload,
        revision: 1,
        updated_at: new Date().toISOString()
      }
    });
    return rows?.[0] || null;
  }

  async function updateCloudRow(payload) {
    const currentSession = await validSession();
    const nextRevision = revision + 1;
    const rows = await request(`/rest/v1/nourishplan_states?select=payload,revision,updated_at&user_id=eq.${encodeURIComponent(currentSession.user.id)}&revision=eq.${revision}`, {
      method: "PATCH",
      accessToken: currentSession.access_token,
      prefer: "return=representation",
      body: {
        payload,
        revision: nextRevision,
        updated_at: new Date().toISOString()
      }
    });
    return rows?.[0] || null;
  }

  function acceptCloudRow(row, { announce = false } = {}) {
    if (!row) return false;
    revision = Number(row.revision) || 1;
    dirty = false;
    applyRemoteState(row.payload);
    emit({
      phase: "synced",
      message: announce ? "Latest cloud data loaded" : "Synced across devices",
      lastSyncedAt: row.updated_at || new Date().toISOString()
    });
    return true;
  }

  async function pushNow() {
    if (!session) return false;
    if (activeRequest) {
      pushQueued = true;
      return activeRequest;
    }
    clearTimeout(saveTimer);
    saveTimer = null;
    pushQueued = false;
    const serialAtStart = changeSerial;
    activeRequest = (async () => {
      emit({ phase: "syncing", message: "Syncing changes…" });
      try {
        let row;
        if (revision === null) {
          const existing = await fetchCloudRow();
          if (existing) {
            acceptCloudRow(existing, { announce: true });
            return false;
          }
          row = await insertCloudRow(getLocalState());
        } else {
          row = await updateCloudRow(getLocalState());
          if (!row) {
            const newer = await fetchCloudRow();
            if (newer) acceptCloudRow(newer, { announce: true });
            return false;
          }
        }
        revision = Number(row.revision) || 1;
        dirty = changeSerial !== serialAtStart;
        emit({
          phase: dirty ? "pending" : "synced",
          message: dirty ? "Cloud save pending…" : "Synced across devices",
          lastSyncedAt: row.updated_at || new Date().toISOString()
        });
        return true;
      } catch (error) {
        dirty = true;
        emit({
          phase: isOffline() ? "offline" : "error",
          message: isOffline() ? "Offline · changes pending" : "Sync paused · changes kept locally"
        });
        return false;
      } finally {
        activeRequest = null;
        if (pushQueued && dirty && status.phase !== "error" && status.phase !== "offline") {
          clearTimeout(saveTimer);
          saveTimer = setTimeout(pushNow, 0);
        }
      }
    })();
    return activeRequest;
  }

  function scheduleSave(delay = 650) {
    if (!session) {
      emit({ phase: "local", message: "Saved on this device" });
      return;
    }
    changeSerial += 1;
    dirty = true;
    pushQueued = true;
    emit({ phase: "pending", message: "Cloud save pending…" });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushNow, delay);
  }

  async function pullNow({ announce = false } = {}) {
    if (!session || activeRequest) return false;
    if (dirty) return pushNow();
    const serialAtStart = changeSerial;
    activeRequest = (async () => {
      emit({ phase: "syncing", message: "Checking cloud…" });
      try {
        const row = await fetchCloudRow();
        if (dirty || changeSerial !== serialAtStart) {
          pushQueued = true;
          emit({ phase: "pending", message: "Cloud save pending…" });
          return false;
        }
        if (!row) {
          const created = await insertCloudRow(getLocalState());
          revision = Number(created?.revision) || 1;
          dirty = false;
          emit({
            phase: "synced",
            message: "Synced across devices",
            lastSyncedAt: created?.updated_at || new Date().toISOString()
          });
          return true;
        }
        if (revision === null || Number(row.revision) > revision) {
          acceptCloudRow(row, { announce });
        } else {
          emit({
            phase: "synced",
            message: "Synced across devices",
            lastSyncedAt: row.updated_at || status.lastSyncedAt
          });
        }
        return true;
      } catch (error) {
        emit({
          phase: isOffline() ? "offline" : "error",
          message: isOffline() ? "Offline · using saved data" : "Cloud unavailable · using saved data"
        });
        return false;
      } finally {
        activeRequest = null;
        if (pushQueued && dirty && status.phase !== "error" && status.phase !== "offline") {
          clearTimeout(saveTimer);
          saveTimer = setTimeout(pushNow, 0);
        }
      }
    })();
    return activeRequest;
  }

  async function connectSession(nextSession) {
    persistSession(nextSession);
    revision = null;
    dirty = false;
    emit({ phase: "syncing", message: "Connecting to your meals…", lastSyncedAt: null });
    const row = await fetchCloudRow();
    if (row) acceptCloudRow(row);
    else {
      dirty = true;
      await pushNow();
    }
  }

  async function signIn(email, password) {
    const data = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password }
    });
    await connectSession(data);
    return { needsConfirmation: false };
  }

  async function signUp(email, password) {
    const data = await request("/auth/v1/signup", {
      method: "POST",
      body: { email, password }
    });
    if (data?.access_token) {
      await connectSession(data);
      return { needsConfirmation: false };
    }
    emit({
      phase: "verification",
      message: "Check your email, then sign in",
      email,
      signedIn: false
    });
    return { needsConfirmation: true };
  }

  async function signOut() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (session?.access_token) {
      try {
        await request("/auth/v1/logout", {
          method: "POST",
          accessToken: session.access_token
        });
      } catch {}
    }
    persistSession(null);
    revision = null;
    dirty = false;
    emit({ phase: "local", message: "Saved on this device", lastSyncedAt: null });
  }

  async function initialize() {
    if (initialized) return;
    initialized = true;
    onStatus({ ...status });
    if (!session) return;
    try {
      await validSession();
      const row = await fetchCloudRow();
      if (row) acceptCloudRow(row);
      else {
        dirty = true;
        await pushNow();
      }
    } catch {}
  }

  function snapshot() {
    return { ...status, revision, dirty };
  }

  return {
    initialize,
    pullNow,
    pushNow,
    scheduleSave,
    signIn,
    signOut,
    signUp,
    snapshot
  };
}
