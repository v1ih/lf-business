// Regras de negócio puras: não tocam na tela nem no armazenamento.
// Tudo aqui é coberto pelos testes em tests/lib.test.js.

export const SCHEMA = 2;

export const STAGES = ["Lead", "Contatado", "Reunião", "Proposta", "Negociação", "Fechado", "Perdido"];
export const CLOSED_STAGES = ["Fechado", "Perdido"];
export const PIPELINE_STAGES = ["Proposta", "Negociação"];
export const BUDGET_STATUS = ["Rascunho", "Enviado", "Aprovado", "Recusado"];

export const defaultProfile = () => ({
  name: "",
  business: "",
  email: "",
  phone: "",
  defaultRate: 75,
  defaultBuffer: 20,
  defaultTax: 0,
  validityDays: 15,
  paymentTerms: "50% na aprovação e 50% na entrega.",
});

export const emptyData = () => ({
  schema: SCHEMA,
  profile: defaultProfile(),
  prefs: { theme: "auto", lastBackup: null },
  budgets: [],
  lists: [],
  leads: [],
});

/* ---------- Dinheiro e orçamento ---------- */

// preço = (horas × valor/hora + custos) × (1 + reserva%) ÷ (1 − imposto%)
// O imposto é "por dentro": depois de descontado do preço final, sobra o valor desejado.
export function calcPrice(hours, rate, costs, buffer, tax) {
  const base = hours * rate + costs;
  return Math.round(((base * (1 + buffer / 100)) / (1 - tax / 100)) * 100) / 100;
}

export function validBudgetNumbers({ hours, rate, costs, buffer, tax }) {
  return (
    [hours, rate, costs, buffer, tax].every(Number.isFinite) &&
    hours > 0 &&
    rate > 0 &&
    costs >= 0 &&
    buffer >= 0 &&
    buffer <= 100 &&
    tax >= 0 &&
    tax <= 90
  );
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (n) => brl.format(Number(n) || 0);

/* ---------- Texto e HTML ---------- */

// Escapa texto do usuário antes de ir para o innerHTML (evita XSS).
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

export const uid = () =>
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

/* ---------- Datas (sempre no fuso do aparelho) ---------- */

// "YYYY-MM-DD" do dia local. toISOString() daria o dia em UTC,
// que às 21h no Brasil já é amanhã.
export function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + n));
}

export const formatDay = (day) => (day ? day.split("-").reverse().join("/") : "");
export const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

export function daysBetween(fromDay, toDay) {
  const [a, b] = [fromDay, toDay].map((s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000);
}

/* ---------- Prospecção ---------- */

export const isOpen = (lead) => !CLOSED_STAGES.includes(lead.status);

// Separa os retornos agendados em atrasados, hoje e próximos 7 dias.
export function followUps(leads, today = localDay()) {
  const out = { overdue: [], today: [], upcoming: [] };
  const limit = addDays(today, 7);
  for (const lead of leads) {
    if (!lead.follow || !isOpen(lead)) continue;
    if (lead.follow < today) out.overdue.push(lead);
    else if (lead.follow === today) out.today.push(lead);
    else if (lead.follow <= limit) out.upcoming.push(lead);
  }
  const byDate = (a, b) => a.follow.localeCompare(b.follow);
  out.overdue.sort(byDate);
  out.upcoming.sort(byDate);
  return out;
}

export function funnel(leads) {
  return STAGES.map((stage) => {
    const items = leads.filter((l) => l.status === stage);
    return { stage, count: items.length, value: sum(items, "value") };
  });
}

export const pipelineValue = (leads) =>
  sum(
    leads.filter((l) => PIPELINE_STAGES.includes(l.status)),
    "value",
  );

export function wonInMonth(leads, now = new Date()) {
  const month = localDay(now).slice(0, 7);
  return sum(
    leads.filter(
      (l) => l.status === "Fechado" && l.closedAt && localDay(new Date(l.closedAt)).startsWith(month),
    ),
    "value",
  );
}

// Taxa de aprovação considera só orçamentos que já tiveram resposta.
export function approvalRate(budgets) {
  const approved = budgets.filter((b) => b.status === "Aprovado").length;
  const answered = approved + budgets.filter((b) => b.status === "Recusado").length;
  return answered ? Math.round((approved / answered) * 100) : null;
}

function sum(items, key) {
  return Math.round(items.reduce((n, i) => n + (Number(i[key]) || 0), 0) * 100) / 100;
}

/* ---------- Proposta ---------- */

export function proposalText(budget, profile, today = localDay()) {
  const who = profile.business || profile.name || "Proposta comercial";
  const lines = [
    `*${who}*`,
    "",
    `Olá${budget.client ? `, ${budget.client}` : ""}! Segue a proposta para *${budget.name}*.`,
  ];
  if (budget.scope) lines.push("", "*Escopo*", budget.scope);
  lines.push("", `*Investimento:* ${money(budget.price)}`);
  if (profile.paymentTerms) lines.push(`*Pagamento:* ${profile.paymentTerms}`);
  if (profile.validityDays) lines.push(`*Validade:* até ${formatDay(addDays(today, profile.validityDays))}`);
  const contact = [profile.name, profile.phone, profile.email].filter(Boolean).join(" · ");
  if (contact) lines.push("", contact);
  return lines.join("\n");
}

// Tenta extrair um celular brasileiro de um texto livre ("WhatsApp (21) 99999-0000").
export function phoneDigits(text) {
  const digits = String(text ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

export function whatsappLink(text, phoneText) {
  const phone = phoneDigits(phoneText);
  return `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
}

/* ---------- Formato dos dados e migração ---------- */

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const LIMIT = 10000;

export function validData(d) {
  return (
    isObj(d) &&
    ["budgets", "lists", "leads"].every((k) => Array.isArray(d[k]) && d[k].length < LIMIT) &&
    d.budgets.every(isObj) &&
    d.leads.every(isObj) &&
    d.lists.every((l) => isObj(l) && Array.isArray(l.items) && l.items.length < LIMIT)
  );
}

// Converte qualquer versão conhecida para a atual. Devolve null se não reconhecer.
// v1 (sem campo schema): só budgets, lists e leads.
export function migrate(raw) {
  if (!validData(raw)) return null;
  const version = raw.schema ?? 1;
  if (version > SCHEMA) return null;
  const base = emptyData();
  return {
    schema: SCHEMA,
    profile: { ...base.profile, ...(isObj(raw.profile) ? raw.profile : {}) },
    prefs: { ...base.prefs, ...(isObj(raw.prefs) ? raw.prefs : {}) },
    budgets: raw.budgets.map((b) => ({
      client: "",
      scope: "",
      status: "Rascunho",
      ...b,
    })),
    lists: raw.lists.map((l) => ({ ...l, items: l.items.filter(isObj) })),
    leads: raw.leads.map((l) => ({
      closedAt: l.status === "Fechado" ? (l.created ?? null) : null,
      ...l,
      status: STAGES.includes(l.status) ? l.status : "Lead",
    })),
  };
}

// Aceita o backup no formato { schema, data } (v1 e v2).
export function readBackup(parsed) {
  if (!isObj(parsed) || !isObj(parsed.data)) return null;
  return migrate({ schema: parsed.schema, ...parsed.data });
}

/* ---------- Dados de demonstração ---------- */

export function demoData(today = localDay()) {
  const now = new Date().toISOString();
  const d = emptyData();
  d.profile = {
    ...d.profile,
    name: "Lavínia Ferraz",
    business: "Lavínia Ferraz | Soluções Digitais",
    email: "contato@exemplo.com",
    phone: "(21) 99999-0000",
  };
  const lead = (company, person, contact, service, value, status, follow) => ({
    id: uid(),
    company,
    person,
    contact,
    service,
    value,
    status,
    follow: follow == null ? "" : addDays(today, follow),
    notes: "",
    created: now,
    updated: now,
    closedAt: status === "Fechado" ? now : null,
  });
  d.leads = [
    lead(
      "Clínica Bem Estar",
      "Dra. Ana",
      "WhatsApp (21) 98888-1111",
      "Site institucional",
      2250,
      "Proposta",
      0,
    ),
    lead(
      "Padaria Central",
      "Seu Jorge",
      "Instagram @padariacentral",
      "Cardápio digital",
      900,
      "Contatado",
      -2,
    ),
    lead(
      "Studio Pilates Leve",
      "Marina",
      "marina@exemplo.com",
      "Landing page + agenda",
      1800,
      "Negociação",
      3,
    ),
    lead("Loja Mary Bless", "Bruna", "WhatsApp (21) 97777-2222", "Loja Nuvemshop", 4200, "Fechado", null),
    lead("Ótica Visão", "", "Indicação", "Site + Google Meu Negócio", 1500, "Lead", 5),
  ];
  const budget = (name, client, hours, rate, buffer, tax, status, scope) => ({
    id: uid(),
    name,
    client,
    hours,
    rate,
    costs: 0,
    buffer,
    tax,
    status,
    scope,
    price: calcPrice(hours, rate, 0, buffer, tax),
    created: now,
    updated: now,
  });
  d.budgets = [
    budget(
      "Loja Nuvemshop",
      "Loja Mary Bless",
      45,
      80,
      15,
      6,
      "Aprovado",
      "Configuração da loja, 40 produtos, frete e meios de pagamento.",
    ),
    budget(
      "Site institucional",
      "Clínica Bem Estar",
      25,
      75,
      20,
      0,
      "Enviado",
      "Site de 5 páginas, responsivo, com botão de WhatsApp e SEO básico.",
    ),
    budget("Landing page + agenda", "Studio Pilates Leve", 20, 75, 20, 0, "Rascunho", ""),
  ];
  const item = (text, done) => ({ id: uid(), text, done });
  d.lists = [
    {
      id: uid(),
      name: "Entrega Mary Bless",
      created: now,
      items: [
        item("Cadastrar categorias", true),
        item("Subir fotos dos produtos", true),
        item("Configurar frete", false),
        item("Treinamento com a cliente", false),
      ],
    },
    {
      id: uid(),
      name: "Rotina de prospecção da semana",
      created: now,
      items: [
        item("Mandar 10 mensagens novas", true),
        item("Retornar quem pediu proposta", false),
        item("Publicar 1 post de portfólio", false),
      ],
    },
  ];
  return d;
}
