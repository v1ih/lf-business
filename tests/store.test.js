import { test } from "node:test";
import assert from "node:assert/strict";
import { load, save, KEY } from "../js/store.js";

// Imitação mínima do localStorage para rodar no Node.
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
  };
}

test("primeira visita começa vazio", () => {
  const { data, status } = load(fakeStorage());
  assert.equal(status, "new");
  assert.equal(data.budgets.length, 0);
});

test("salva e carrega de volta", () => {
  const storage = fakeStorage();
  const { data } = load(storage);
  data.leads.push({ id: "1", company: "Teste", status: "Lead" });
  assert.equal(save(data, storage), true);
  assert.equal(load(storage).data.leads[0].company, "Teste");
});

test("dados ilegíveis: guarda uma cópia e começa do zero", () => {
  const storage = fakeStorage({ [KEY]: "{isso não é json" });
  const { status, data } = load(storage);
  assert.equal(status, "recovered");
  assert.equal(data.leads.length, 0);
  const backup = Object.keys(storage.data).find((k) => k.startsWith(`${KEY}-corrompido-`));
  assert.equal(storage.data[backup], "{isso não é json");
});

test("armazenamento bloqueado não quebra o app", () => {
  const blocked = {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("QuotaExceeded");
    },
  };
  assert.equal(load(blocked).status, "unavailable");
  assert.equal(save({}, blocked), false);
});
