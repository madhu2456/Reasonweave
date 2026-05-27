import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RuntimeLedger } from "../lib/ledger.mjs";

function tempLedger() {
  return new RuntimeLedger(fs.mkdtempSync(path.join(os.tmpdir(), "reasonweave-ledger-")));
}

test("ledger appends runs and rejects replayed receipts", () => {
  const ledger = tempLedger();
  const record = {
    run_id: "run-ledger-test",
    receipt: {
      run_id: "run-ledger-test",
      nonce: "nonce-ledger-test",
      issued_at: new Date().toISOString(),
    },
  };
  ledger.appendRun(record);
  assert.throws(() => ledger.appendRun(record), /replayed_run_id_nonce/);
});

test("ledger rejects a replay even when an interrupted write left no replay index", () => {
  const ledger = tempLedger();
  const record = {
    run_id: "run-interrupted",
    receipt: {
      run_id: "run-interrupted",
      nonce: "nonce-interrupted",
      issued_at: new Date().toISOString(),
    },
  };
  ledger.ensureDir();
  fs.writeFileSync(ledger.runsPath, `${JSON.stringify(record)}\n`, "utf8");
  assert.equal(fs.existsSync(ledger.replayPath), false);
  assert.throws(() => ledger.appendRun(record), /replayed_run_id_nonce/);
});

test("ledger refuses a receipted append when corrupted history makes replay checks incomplete", () => {
  const ledger = tempLedger();
  ledger.ensureDir();
  fs.writeFileSync(ledger.runsPath, "{not-json}\n", "utf8");
  const record = {
    run_id: "run-after-corruption",
    receipt: {
      run_id: "run-after-corruption",
      nonce: "nonce-after-corruption",
      issued_at: new Date().toISOString(),
    },
  };
  assert.throws(() => ledger.appendRun(record), /corrupt_runs_ledger/);
});

test("ledger lock helper preserves callback failure causes", () => {
  const ledger = tempLedger();
  assert.throws(() => ledger.withLock(() => {
    throw new Error("callback_failure");
  }), /^Error: callback_failure$/);
});

test("ledger refuses enforced replay inspection when its replay index is corrupt", () => {
  const ledger = tempLedger();
  ledger.ensureDir();
  fs.writeFileSync(ledger.replayPath, "{not-json}\n", "utf8");
  assert.throws(() => ledger.seenReplayKeys({ requireIntegrity: true }), /corrupt_replay_index/);
});

test("ledger recovers a stale lock left by an interrupted writer", () => {
  const ledger = tempLedger();
  ledger.ensureDir();
  fs.writeFileSync(ledger.lockPath, "stale", "utf8");
  const stale = new Date(Date.now() - 60000);
  fs.utimesSync(ledger.lockPath, stale, stale);
  const stored = ledger.appendRun({ run_id: "run-after-stale-lock" });
  assert.equal(stored.run_id, "run-after-stale-lock");
});

test("ledger lists valid rows and reports corrupted rows", () => {
  const ledger = tempLedger();
  ledger.appendRun({ run_id: "run-ok" });
  fs.appendFileSync(ledger.runsPath, "{not-json}\n", "utf8");
  const result = ledger.listRuns();
  assert.equal(result.runs.length, 1);
  assert.equal(result.corrupt_rows, 1);
});

test("ledger redacts secrets before storage", () => {
  const ledger = tempLedger();
  ledger.appendRun({ run_id: "run-redact", Authorization: "Bearer sk-secretvalue12345" });
  const text = fs.readFileSync(ledger.runsPath, "utf8");
  assert.equal(text.includes("sk-secretvalue12345"), false);
  assert.equal(text.includes("[REDACTED]"), true);
});

test("ledger redacts labeled secrets embedded in prompt and output text", () => {
  const ledger = tempLedger();
  ledger.appendRun({
    run_id: "run-labeled-secret",
    prompt: { prompt_preview: "password=hunter2 token: refresh-value" },
    output_text: '{"cookie":"session-value"}',
  });
  const text = fs.readFileSync(ledger.runsPath, "utf8");
  assert.equal(text.includes("hunter2"), false);
  assert.equal(text.includes("refresh-value"), false);
  assert.equal(text.includes("session-value"), false);
});
