import assert from "node:assert/strict";
import { createCloudSync } from "../lib/cloud-sync.mjs";

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "aj@example.com" };

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return data == null ? "" : JSON.stringify(data);
    }
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function fakeCloud() {
  let row = null;
  let timestamp = 0;
  let patchGate = null;
  let patchStarted = null;
  const fetchImpl = async (url, options = {}) => {
    const requestUrl = new URL(url);
    const body = options.body ? JSON.parse(options.body) : null;
    if (requestUrl.pathname === "/auth/v1/token") {
      return response(200, {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        user: USER
      });
    }
    if (requestUrl.pathname === "/auth/v1/logout") return response(204, null);
    if (requestUrl.pathname !== "/rest/v1/nourishplan_states") return response(404, { message: "Not found" });
    if (options.method === "POST") {
      if (row) return response(409, { message: "duplicate key" });
      row = { payload: body.payload, revision: 1, updated_at: `2026-09-10T00:00:0${++timestamp}Z` };
      return response(201, [row]);
    }
    if (options.method === "PATCH") {
      if (patchGate) {
        patchStarted();
        await patchGate.promise;
        patchGate = null;
        patchStarted = null;
      }
      const expected = Number(requestUrl.searchParams.get("revision")?.replace("eq.", ""));
      if (!row || row.revision !== expected) return response(200, []);
      row = { payload: body.payload, revision: body.revision, updated_at: `2026-09-10T00:00:0${++timestamp}Z` };
      return response(200, [row]);
    }
    return response(200, row ? [row] : []);
  };
  return {
    fetchImpl,
    getRow: () => structuredClone(row),
    holdNextPatch() {
      let release;
      let started;
      const startedPromise = new Promise((resolve) => { started = resolve; });
      const promise = new Promise((resolve) => { release = resolve; });
      patchGate = { promise, release };
      patchStarted = started;
      return { started: startedPromise, release };
    }
  };
}

function client(cloud, initialState) {
  let localState = structuredClone(initialState);
  const statuses = [];
  const sync = createCloudSync({
    url: "https://example.supabase.co",
    publishableKey: "sb_publishable_test",
    storage: memoryStorage(),
    fetchImpl: cloud.fetchImpl,
    getLocalState: () => localState,
    applyRemoteState: (payload) => { localState = structuredClone(payload); },
    onStatus: (status) => statuses.push(status)
  });
  return {
    sync,
    statuses,
    getState: () => structuredClone(localState),
    setState: (value) => { localState = structuredClone(value); }
  };
}

const cloud = fakeCloud();
const first = client(cloud, { plan: { monday: "oats" }, recipes: ["oats"] });
await first.sync.signIn(USER.email, "correct-horse");
assert.deepEqual(cloud.getRow().payload.plan, { monday: "oats" }, "first device uploads its local state");
assert.equal(cloud.getRow().revision, 1);

const second = client(cloud, { plan: { monday: "local-placeholder" }, recipes: [] });
await second.sync.signIn(USER.email, "correct-horse");
assert.deepEqual(second.getState().plan, { monday: "oats" }, "later device downloads cloud state");

second.setState({ plan: { monday: "adobo" }, recipes: ["adobo"] });
second.sync.scheduleSave(0);
await second.sync.pushNow();
assert.deepEqual(cloud.getRow().payload.plan, { monday: "adobo" }, "signed-in changes upload");
assert.equal(cloud.getRow().revision, 2);

first.setState({ plan: { monday: "stale-edit" }, recipes: ["stale-edit"] });
first.sync.scheduleSave(0);
await first.sync.pushNow();
assert.deepEqual(cloud.getRow().payload.plan, { monday: "adobo" }, "stale revision cannot overwrite newer cloud data");
assert.deepEqual(first.getState().plan, { monday: "adobo" }, "stale device reloads the latest cloud copy");
assert.equal(first.sync.snapshot().phase, "synced");

const delayed = cloud.holdNextPatch();
second.setState({ plan: { monday: "tinola" }, recipes: ["tinola"] });
second.sync.scheduleSave(0);
const firstPush = second.sync.pushNow();
await delayed.started;
second.setState({ plan: { monday: "monggo" }, recipes: ["monggo"] });
second.sync.scheduleSave(0);
delayed.release();
await firstPush;
await new Promise((resolve) => setTimeout(resolve, 20));
assert.deepEqual(cloud.getRow().payload.plan, { monday: "monggo" }, "an edit made during an active request is queued and uploaded next");

await second.sync.signOut();
assert.equal(second.sync.snapshot().signedIn, false);

console.log("Cloud sync checks passed: upload, multi-device download, queued edits, revision updates, and stale-write protection.");
