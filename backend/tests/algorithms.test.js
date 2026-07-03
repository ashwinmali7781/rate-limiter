import { test } from "node:test";
import assert from "node:assert/strict";
import { fixedWindow } from "../algorithms/fixedWindow.js";
import { slidingWindowCounter } from "../algorithms/slidingWindowCounter.js";

/**
 * Minimal in-memory Redis stand-in covering only the commands these
 * algorithms use, so tests don't require a running Redis instance.
 */
class FakeRedis {
  constructor() {
    this.store = new Map();
  }
  async incr(key) {
    const val = (this.store.get(key) || 0) + 1;
    this.store.set(key, val);
    return val;
  }
  async get(key) {
    return this.store.has(key) ? String(this.store.get(key)) : null;
  }
  async expire() {
    return 1;
  }
  pipeline() {
    const ops = [];
    const self = this;
    return {
      incr(key) {
        ops.push(["incr", key]);
        return this;
      },
      get(key) {
        ops.push(["get", key]);
        return this;
      },
      async exec() {
        const results = [];
        for (const [cmd, key] of ops) {
          const val = await self[cmd](key);
          results.push([null, val]);
        }
        return results;
      },
    };
  }
}

test("fixedWindow allows requests under the limit and blocks over it", async () => {
  const redis = new FakeRedis();
  const params = { ruleId: "r1", clientId: "c1", limit: 3, windowSeconds: 60 };

  const r1 = await fixedWindow(redis, params);
  const r2 = await fixedWindow(redis, params);
  const r3 = await fixedWindow(redis, params);
  const r4 = await fixedWindow(redis, params);

  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, true);
  assert.equal(r3.allowed, true);
  assert.equal(r4.allowed, false);
  assert.equal(r4.remaining, 0);
});

test("fixedWindow tracks separate counters per client", async () => {
  const redis = new FakeRedis();
  const base = { ruleId: "r1", limit: 1, windowSeconds: 60 };

  const a = await fixedWindow(redis, { ...base, clientId: "clientA" });
  const b = await fixedWindow(redis, { ...base, clientId: "clientB" });

  assert.equal(a.allowed, true);
  assert.equal(b.allowed, true); // different client, independent counter
});

test("slidingWindowCounter allows requests under the limit", async () => {
  const redis = new FakeRedis();
  const params = { ruleId: "r1", clientId: "c1", limit: 5, windowSeconds: 60 };

  const r1 = await slidingWindowCounter(redis, params);
  const r2 = await slidingWindowCounter(redis, params);

  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, true);
  assert.ok(r2.remaining <= 4);
});

test("slidingWindowCounter blocks once weighted count exceeds limit", async () => {
  const redis = new FakeRedis();
  const params = { ruleId: "r1", clientId: "c1", limit: 2, windowSeconds: 60 };

  await slidingWindowCounter(redis, params);
  await slidingWindowCounter(redis, params);
  const third = await slidingWindowCounter(redis, params);

  assert.equal(third.allowed, false);
});
