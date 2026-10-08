// Persistência no localStorage. A chave continua a mesma da v1
// para que os dados de quem já usa o app sejam migrados, e não perdidos.
import { emptyData, migrate } from "./lib.js";

export const KEY = "lf-business-v1";

export function load(storage = globalThis.localStorage) {
  let raw;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return { data: emptyData(), status: "unavailable" };
  }
  if (!raw) return { data: emptyData(), status: "new" };
  let data = null;
  try {
    data = migrate(JSON.parse(raw));
  } catch {
    data = null;
  }
  if (data) return { data, status: "ok" };
  // Formato desconhecido: guarda uma cópia antes de começar do zero.
  try {
    storage.setItem(`${KEY}-corrompido-${Date.now()}`, raw);
  } catch {
    /* sem espaço: segue sem a cópia */
  }
  return { data: emptyData(), status: "recovered" };
}

export function save(data, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function isEmpty(data) {
  return !data.budgets.length && !data.lists.length && !data.leads.length;
}
