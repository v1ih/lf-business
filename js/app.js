import {
  STAGES,
  BUDGET_STATUS,
  calcPrice,
  validBudgetNumbers,
  money,
  esc,
  uid,
  localDay,
  addDays,
  daysBetween,
  formatDay,
  formatDate,
  isOpen,
  followUps,
  funnel,
  pipelineValue,
  wonInMonth,
  approvalRate,
  proposalText,
  phoneDigits,
  whatsappLink,
  readBackup,
  demoData,
  emptyData,
} from "./lib.js";
import { load, save as persist, isEmpty } from "./store.js";

/* ================= Estado ================= */

const loaded = load();
let db = loaded.data;
const drafts = {}; // o que foi digitado nos formulários e ainda não foi salvo
const filters = { q: "", stage: "" };

const PAGES = {
  home: { title: "Visão geral", view: home },
  budget: { title: "Orçamentos", view: budget },
  tasks: { title: "Checklists", view: tasks },
  leads: { title: "Prospecção", view: leads },
  settings: { title: "Seus dados", view: settings },
};
let page = PAGES[location.hash.slice(1)] ? location.hash.slice(1) : "home";

const $ = (s, root = document) => root.querySelector(s);

function save() {
  if (!persist(db)) notify("Não foi possível salvar. Verifique o armazenamento do navegador.");
}

// Toda alteração termina aqui: salva e redesenha.
function commit(message, action) {
  save();
  render();
  if (message) notify(message, action);
}

/* ================= Utilidades de interface ================= */

function notify(message, action) {
  const el = $("#toast");
  el.innerHTML = `<span>${esc(message)}</span>${
    action ? `<button type="button" class="toast-action">${esc(action.label)}</button>` : ""
  }`;
  el.classList.add("show");
  const hide = () => el.classList.remove("show");
  if (action)
    el.querySelector("button").onclick = () => {
      hide();
      action.run();
    };
  clearTimeout(notify.timer);
  notify.timer = setTimeout(hide, action ? 6000 : 3200);
}

// Exclui sem pedir confirmação, mas permite desfazer por alguns segundos.
function removeWithUndo(message, mutate) {
  const snapshot = structuredClone(db);
  mutate();
  commit(message, {
    label: "Desfazer",
    run() {
      db = snapshot;
      commit("Restaurado.");
    },
  });
}

const btn = (label, action, kind = "secondary", extra = "") =>
  `<button type="button" class="btn ${kind}" data-action="${action}" ${extra}>${label}</button>`;
const empty = (msg, cta = "") => `<div class="empty"><p>${msg}</p>${cta}</div>`;
const draft = (form, name, fallback) => drafts[form]?.[name] ?? fallback;
const options = (list, selected) =>
  list.map((o) => `<option ${o === selected ? "selected" : ""}>${esc(o)}</option>`).join("");

function field(label, control, cls = "") {
  return `<label class="field ${cls}"><span>${label}</span>${control}</label>`;
}
function input(name, value, attrs = "") {
  return `<input name="${name}" value="${esc(value ?? "")}" ${attrs}>`;
}

function relativeDay(day, today = localDay()) {
  const diff = daysBetween(today, day);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  return diff < 0 ? `há ${-diff} dias` : `em ${diff} dias`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const leadByCompany = (name) =>
  name ? db.leads.find((l) => l.company.toLowerCase() === name.toLowerCase()) : undefined;

/* ================= Render ================= */

function render() {
  document.querySelectorAll(".nav").forEach((n) => {
    const active = n.dataset.page === page;
    n.classList.toggle("active", active);
    n.toggleAttribute("aria-current", active);
  });
  $("#page-title").textContent = PAGES[page].title;
  document.title = page === "home" ? "LF Business" : `${PAGES[page].title} · LF Business`;
  $("#content").innerHTML = PAGES[page].view();
}

function go(next) {
  if (!PAGES[next]) return;
  page = next;
  if (location.hash.slice(1) !== next) history.pushState(null, "", `#${next}`);
  render();
  $("#content").focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

function applyTheme() {
  const theme = db.prefs.theme;
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

/* ================= Telas ================= */

function home() {
  const today = localDay();
  const items = db.lists.flatMap((l) => l.items);
  const done = items.filter((i) => i.done).length;
  const pipeline = db.leads.filter((l) => ["Proposta", "Negociação"].includes(l.status));
  const rate = approvalRate(db.budgets);
  const answered = db.budgets.filter((b) => ["Aprovado", "Recusado"].includes(b.status)).length;
  const due = followUps(db.leads, today);
  const backupAge = db.prefs.lastBackup ? daysBetween(db.prefs.lastBackup, today) : null;

  const onboarding = isEmpty(db)
    ? `<section class="panel onboarding">
        <span class="eyebrow">COMECE POR AQUI</span>
        <h2>Bem-vinda ao LF Business</h2>
        <ol class="steps">
          <li><b>Complete seu perfil</b> com nome, contato e valor da sua hora. Ele aparece nas propostas.</li>
          <li><b>Faça um orçamento</b> e gere a proposta para mandar pelo WhatsApp ou em PDF.</li>
          <li><b>Cadastre seus contatos</b> e defina a data do próximo retorno. O app te lembra.</li>
        </ol>
        <div class="actions">
          <button type="button" class="btn" data-page="settings">Completar perfil</button>
          ${btn("Ver com dados de exemplo", "demo")}
        </div>
      </section>`
    : "";

  const backup =
    !isEmpty(db) && (backupAge === null || backupAge >= 7)
      ? `<section class="panel notice">
          <div><strong>Faça um backup dos seus dados</strong>
          <p class="muted">${backupAge === null ? "Você ainda não fez nenhum backup." : `Último backup ${relativeDay(db.prefs.lastBackup)}.`} Os dados ficam só neste aparelho.</p></div>
          ${btn("Exportar backup", "export", "")}
        </section>`
      : "";

  const followRow = (l, kind) => {
    const phone = phoneDigits(l.contact);
    return `<div class="item follow ${kind}">
      <div class="item-body">
        <strong>${esc(l.company)}</strong> <span class="chip">${esc(l.status)}</span>
        <p>${esc(l.service || l.contact || "")}${l.value ? " · " + money(l.value) : ""}</p>
        <p class="when">${kind === "overdue" ? "Atrasado: " : ""}${relativeDay(l.follow, today)} (${formatDay(l.follow)})</p>
      </div>
      <div class="actions">
        ${phone ? `<a class="btn secondary small" href="https://wa.me/${phone}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        ${btn("Feito", `follow-done:${l.id}`, "small")}
        ${btn("Adiar 2 dias", `follow-snooze:${l.id}`, "secondary small")}
      </div>
    </div>`;
  };
  const group = (title, list, kind) =>
    list.length
      ? `<h3 class="group-title">${title} <span class="count">${list.length}</span></h3>${list.map((l) => followRow(l, kind)).join("")}`
      : "";
  const dueTotal = due.overdue.length + due.today.length + due.upcoming.length;

  return `${onboarding}
  <div class="grid four">
    <div class="panel metric-card"><span class="eyebrow">EM NEGOCIAÇÃO</span><div class="metric">${money(pipelineValue(db.leads))}</div><p class="muted">${plural(pipeline.length, "contato", "contatos")} em proposta ou negociação</p></div>
    <div class="panel metric-card"><span class="eyebrow">FECHADO ESTE MÊS</span><div class="metric">${money(wonInMonth(db.leads))}</div><p class="muted">Contatos marcados como Fechado</p></div>
    <div class="panel metric-card"><span class="eyebrow">APROVAÇÃO DE ORÇAMENTOS</span><div class="metric">${rate === null ? "—" : rate + "%"}</div><p class="muted">${answered ? `${plural(answered, "orçamento respondido", "orçamentos respondidos")}` : "Marque os orçamentos como Aprovado ou Recusado"}</p></div>
    <div class="panel metric-card"><span class="eyebrow">TAREFAS CONCLUÍDAS</span><div class="metric">${done}/${items.length}</div><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${items.length ? Math.round((100 * done) / items.length) : 0}"><span style="width:${items.length ? (100 * done) / items.length : 0}%"></span></div></div>
  </div>
  ${backup}
  <div class="grid two section">
    <section class="panel">
      <div class="section-head"><h2>Retornos agendados</h2>${dueTotal ? `<span class="tag">${dueTotal}</span>` : ""}</div>
      ${dueTotal ? `<div class="list">${group("Atrasados", due.overdue, "overdue")}${group("Hoje", due.today, "today")}${group("Próximos 7 dias", due.upcoming, "upcoming")}</div>` : empty("Nenhum retorno nos próximos 7 dias. Preencha “Próximo contato” nos seus contatos para o app te lembrar.", `<button type="button" class="btn secondary small" data-page="leads">Ir para Prospecção</button>`)}
    </section>
    <section class="panel">
      <h2>Atalhos</h2>
      <p class="muted">Tudo fica salvo automaticamente neste aparelho e funciona sem internet.</p>
      <div class="shortcuts">
        <button type="button" class="shortcut" data-page="budget"><b>Novo orçamento</b><span>Calcule o preço e gere a proposta</span></button>
        <button type="button" class="shortcut" data-page="leads"><b>Novo contato</b><span>Registre uma oportunidade</span></button>
        <button type="button" class="shortcut" data-page="tasks"><b>Checklists</b><span>Acompanhe as entregas</span></button>
      </div>
    </section>
  </div>`;
}

function budgetFields(form, v) {
  const val = (name, fallback) => draft(form, name, v[name] ?? fallback);
  return `
    ${field("Nome do projeto", input("name", val("name", ""), 'required maxlength="100" placeholder="Ex.: Landing page para clínica"'), "span-all")}
    ${field("Cliente", input("client", val("client", ""), 'maxlength="100" list="lead-names" placeholder="Opcional" autocomplete="off"'))}
    ${field("Situação", `<select name="status">${options(BUDGET_STATUS, val("status", "Rascunho"))}</select>`)}
    ${field("Horas estimadas", input("hours", val("hours", 10), 'type="number" inputmode="decimal" min="0.5" max="10000" step="0.5" required'))}
    ${field("Valor por hora (R$)", input("rate", val("rate", db.profile.defaultRate), 'type="number" inputmode="decimal" min="1" max="100000" step="0.01" required'))}
    ${field("Custos adicionais (R$)", input("costs", val("costs", 0), 'type="number" inputmode="decimal" min="0" max="10000000" step="0.01" required'))}
    ${field("Reserva para imprevistos (%)", input("buffer", val("buffer", db.profile.defaultBuffer), 'type="number" inputmode="decimal" min="0" max="100" step="1" required'))}
    ${field("Impostos e taxas sobre o preço final (%)", input("tax", val("tax", db.profile.defaultTax), 'type="number" inputmode="decimal" min="0" max="90" step="0.5" required'), "span-all")}
    ${field("Escopo: o que está incluso", `<textarea name="scope" maxlength="2000" placeholder="Ex.: site de 5 páginas, responsivo, com formulário de contato. Aparece na proposta.">${esc(val("scope", ""))}</textarea>`, "span-all")}
    <div class="span-all result"><small>PREÇO ESTIMADO</small><strong data-price>${priceLabel(readBudget(new Map(Object.entries({ hours: val("hours", 10), rate: val("rate", db.profile.defaultRate), costs: val("costs", 0), buffer: val("buffer", db.profile.defaultBuffer), tax: val("tax", db.profile.defaultTax) }))))}</strong>
    <p class="hint">Referência de orçamento, não lucro líquido. Confirme o regime tributário e os custos reais antes de enviar a proposta.</p></div>`;
}

function leadNamesDatalist() {
  return `<datalist id="lead-names">${db.leads.map((l) => `<option value="${esc(l.company)}">`).join("")}</datalist>`;
}

function budget() {
  const list = db.budgets.slice().reverse();
  const approved = db.budgets.filter((b) => b.status === "Aprovado");
  return `${leadNamesDatalist()}<div class="grid two">
    <section class="panel">
      <h2>Novo orçamento</h2>
      <form data-form="budget" data-draft class="form-grid">
        ${budgetFields("budget", {})}
        <div class="actions span-all"><button class="btn" type="submit">Salvar orçamento</button>${btn("Limpar", "clear-draft:budget")}</div>
      </form>
    </section>
    <section class="panel">
      <div class="section-head"><h2>Histórico</h2>${approved.length ? `<span class="tag">Aprovados: ${money(approved.reduce((n, b) => n + b.price, 0))}</span>` : ""}</div>
      <div class="list">${
        list.length
          ? list
              .map(
                (b) => `<article class="item stacked">
          <div class="item-body">
            <strong>${esc(b.name)}</strong>
            <p>${b.client ? esc(b.client) + " · " : ""}${formatDate(b.created)} · ${b.hours}h × ${money(b.rate)}/h</p>
            <p class="price">${money(b.price)}</p>
          </div>
          <div class="item-side">
            <select class="status-select status-${esc(b.status).toLowerCase()}" data-budget-status="${b.id}" aria-label="Situação do orçamento">${options(BUDGET_STATUS, b.status)}</select>
            <div class="actions">
              ${btn("Proposta", `proposal:${b.id}`, "small")}
              ${btn("Editar", `edit-budget:${b.id}`, "secondary small")}
              ${btn("Duplicar", `dup-budget:${b.id}`, "secondary small")}
              ${btn("Excluir", `del-budget:${b.id}`, "danger small")}
            </div>
          </div>
        </article>`,
              )
              .join("")
          : empty("Nenhum orçamento salvo ainda. Preencha ao lado e salve.")
      }</div>
    </section>
  </div>`;
}

function tasks() {
  return `<section class="panel">
    <form data-form="list" class="inline-form">
      ${field("Novo checklist", input("name", "", 'required maxlength="90" placeholder="Ex.: Entrega Mary Bless"'), "grow")}
      <button class="btn" type="submit">Criar checklist</button>
    </form>
  </section>
  <div class="grid two section">${
    db.lists.length
      ? db.lists
          .map((l) => {
            const done = l.items.filter((i) => i.done).length;
            return `<article class="panel">
        <div class="section-head">
          <div><h2>${esc(l.name)}</h2><p class="hint">${done} de ${l.items.length} concluídas</p></div>
          <div class="actions">
            ${btn("Renomear", `edit-list:${l.id}`, "secondary small")}
            ${btn("Excluir", `del-list:${l.id}`, "danger small")}
          </div>
        </div>
        <div class="progress"><span style="width:${l.items.length ? (100 * done) / l.items.length : 0}%"></span></div>
        <div class="list section">${l.items
          .map(
            (i) => `<div class="item task">
          <label class="checkline item-body"><input type="checkbox" data-check="${l.id}:${i.id}" ${i.done ? "checked" : ""}><span class="${i.done ? "done" : ""}">${esc(i.text)}</span></label>
          <div class="actions">
            ${btn("Editar", `edit-task:${l.id}:${i.id}`, "ghost small", `aria-label="Editar tarefa"`)}
            ${btn("×", `del-task:${l.id}:${i.id}`, "ghost small", `aria-label="Excluir tarefa"`)}
          </div>
        </div>`,
          )
          .join("")}</div>
        <form data-form="task" data-list="${l.id}" class="inline-form section">
          <input aria-label="Nova tarefa" name="text" required maxlength="160" placeholder="Adicionar tarefa">
          <button class="btn small" type="submit">Adicionar</button>
          ${done ? btn("Limpar concluídas", `clear-done:${l.id}`, "secondary small") : ""}
        </form>
      </article>`;
          })
          .join("")
      : `<div class="span-all">${empty("Crie seu primeiro checklist para acompanhar as entregas de um cliente.")}</div>`
  }</div>`;
}

function leadFields(form, v) {
  const val = (name, fallback) => draft(form, name, v[name] ?? fallback);
  return `
    ${field("Empresa / contato", input("company", val("company", ""), 'required maxlength="100" placeholder="Nome da empresa"'))}
    ${field("Pessoa de contato", input("person", val("person", ""), 'maxlength="90" placeholder="Opcional"'))}
    ${field("WhatsApp, e-mail ou rede social", input("contact", val("contact", ""), 'maxlength="200" placeholder="Ex.: (21) 99999-0000"'))}
    ${field("Serviço de interesse", input("service", val("service", ""), 'maxlength="120" placeholder="Site, loja, automação..."'))}
    ${field("Valor potencial (R$)", input("value", val("value", ""), 'type="number" inputmode="decimal" step="0.01" min="0" max="100000000" placeholder="Opcional"'))}
    ${field("Etapa", `<select name="status">${options(STAGES, val("status", "Lead"))}</select>`)}
    ${field("Próximo contato", input("follow", val("follow", ""), 'type="date"'))}
    ${field("Observações", `<textarea name="notes" maxlength="1000" placeholder="Necessidades, proposta enviada, próximos passos">${esc(val("notes", ""))}</textarea>`, "span-all")}`;
}

function leads() {
  const stages = funnel(db.leads);
  return `<div class="funnel" role="group" aria-label="Filtrar por etapa">
    ${stages
      .map(
        (
          s,
        ) => `<button type="button" class="stage ${filters.stage === s.stage ? "active" : ""}" data-action="filter-stage:${s.stage}" aria-pressed="${filters.stage === s.stage}">
      <span>${s.stage}</span><b>${s.count}</b><small>${s.value ? money(s.value) : "—"}</small></button>`,
      )
      .join("")}
  </div>
  <details class="panel section" ${!db.leads.length || drafts.lead ? "open" : ""}>
    <summary><h2>Novo contato</h2></summary>
    <form data-form="lead" data-draft class="form-grid section">
      ${leadFields("lead", {})}
      <div class="actions span-all"><button class="btn" type="submit">Adicionar contato</button>${btn("Limpar", "clear-draft:lead")}</div>
    </form>
  </details>
  <section class="section">
    <div class="section-head">
      <h2>Seus contatos</h2>
      <div class="filters">
        <input type="search" data-filter="q" value="${esc(filters.q)}" placeholder="Buscar empresa, pessoa ou serviço" aria-label="Buscar contatos">
        ${btn("Limpar filtros", "clear-filters", `secondary small ${filters.stage || filters.q ? "" : "hidden"}`, 'id="clear-filters"')}
      </div>
    </div>
    <div class="list" id="lead-list">${leadList()}</div>
  </section>`;
}

function leadList() {
  const today = localDay();
  const q = filters.q.trim().toLowerCase();
  const list = db.leads
    .filter((l) => !filters.stage || l.status === filters.stage)
    .filter(
      (l) =>
        !q ||
        [l.company, l.person, l.service, l.contact, l.notes].some((s) =>
          String(s ?? "")
            .toLowerCase()
            .includes(q),
        ),
    )
    .slice()
    .reverse();
  if (!db.leads.length) return empty("Adicione empresas e acompanhe cada conversa até fechar.");
  if (!list.length) return empty("Nenhum contato encontrado com esses filtros.");
  return list
    .map((l) => {
      const phone = phoneDigits(l.contact);
      const late = l.follow && l.follow < today && isOpen(l);
      return `<article class="item lead">
      <div class="item-body">
        <strong>${esc(l.company)}</strong> <span class="chip stage-${STAGES.indexOf(l.status)}">${esc(l.status)}</span>
        <p>${[l.person, l.contact].filter(Boolean).map(esc).join(" · ")}</p>
        <p>${esc(l.service)}${l.value ? `${l.service ? " · " : ""}<b>${money(l.value)}</b>` : ""}</p>
        ${l.follow && isOpen(l) ? `<p class="${late ? "late" : ""}">Próximo contato: ${formatDay(l.follow)} (${relativeDay(l.follow, today)})</p>` : ""}
        ${l.notes ? `<p class="notes">${esc(l.notes)}</p>` : ""}
      </div>
      <div class="item-side">
        <select data-stage="${l.id}" aria-label="Etapa de ${esc(l.company)}">${options(STAGES, l.status)}</select>
        <div class="actions">
          ${phone ? `<a class="btn secondary small" href="https://wa.me/${phone}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
          ${btn("Editar", `edit-lead:${l.id}`, "secondary small")}
          ${btn("Excluir", `del-lead:${l.id}`, "danger small")}
        </div>
      </div>
    </article>`;
    })
    .join("");
}

function settings() {
  const p = db.profile;
  return `<div class="grid two">
    <section class="panel">
      <h2>Seu perfil</h2>
      <p class="muted">Aparece nas propostas e define os valores padrão dos orçamentos.</p>
      <form data-form="profile" class="form-grid section">
        ${field("Seu nome", input("name", p.name, 'maxlength="80" autocomplete="name"'))}
        ${field("Nome do negócio", input("business", p.business, 'maxlength="100" placeholder="Opcional"'))}
        ${field("E-mail", input("email", p.email, 'type="email" maxlength="120" autocomplete="email"'))}
        ${field("WhatsApp", input("phone", p.phone, 'maxlength="30" autocomplete="tel" inputmode="tel"'))}
        ${field("Valor da sua hora (R$)", input("defaultRate", p.defaultRate, 'type="number" inputmode="decimal" min="1" max="100000" step="0.01" required'))}
        ${field("Reserva padrão (%)", input("defaultBuffer", p.defaultBuffer, 'type="number" min="0" max="100" step="1" required'))}
        ${field("Impostos padrão (%)", input("defaultTax", p.defaultTax, 'type="number" min="0" max="90" step="0.5" required'))}
        ${field("Validade da proposta (dias)", input("validityDays", p.validityDays, 'type="number" min="1" max="365" step="1" required'))}
        ${field("Condições de pagamento", `<textarea name="paymentTerms" maxlength="300">${esc(p.paymentTerms)}</textarea>`, "span-all")}
        <div class="span-all"><button class="btn" type="submit">Salvar perfil</button></div>
      </form>
    </section>
    <div class="stack">
      <section class="panel">
        <h2>Aparência</h2>
        ${field(
          "Tema",
          `<select data-theme-select>${[
            ["auto", "Automático (igual ao aparelho)"],
            ["light", "Claro"],
            ["dark", "Escuro"],
          ]
            .map(([v, t]) => `<option value="${v}" ${db.prefs.theme === v ? "selected" : ""}>${t}</option>`)
            .join("")}</select>`,
        )}
      </section>
      <section class="panel">
        <h2>Backup</h2>
        <p class="muted">Os dados ficam só neste aparelho. Exporte um arquivo para guardar ou para levar para outro aparelho.</p>
        <p class="hint">${db.prefs.lastBackup ? `Último backup: ${formatDay(db.prefs.lastBackup)}.` : "Nenhum backup feito ainda."}</p>
        <div class="actions">${btn("Exportar backup", "export", "")}${btn("Importar backup", "import")}</div>
        <input class="hidden" type="file" id="backup-file" accept="application/json,.json">
        <p class="hint">Importar substitui os dados atuais.</p>
      </section>
      <section class="panel">
        <h2>Privacidade</h2>
        <p class="muted">Não há contas nem servidor: nada do que você cadastra sai deste aparelho. Limpar os dados do navegador apaga tudo, por isso mantenha um backup.</p>
        <p class="hint">Para instalar: no Android, menu ⋮ → <i>Instalar app</i>. No iPhone, Compartilhar → <i>Adicionar à Tela de Início</i>.</p>
        <div class="actions">${isEmpty(db) ? btn("Carregar dados de exemplo", "demo") : ""}${btn("Apagar todos os dados", "reset", "danger")}</div>
      </section>
    </div>
  </div>`;
}

/* ================= Diálogos ================= */

const dialog = () => $("#dialog");

function openDialog({ title, body, form, id = "", submit = "Salvar", wide = false }) {
  const d = dialog();
  d.classList.toggle("wide", wide);
  d.innerHTML = `<form ${form ? `data-form="${form}" data-id="${id}"` : ""} class="dialog-form">
    <header><h2>${title}</h2><button type="button" class="icon-btn" data-action="close-dialog" aria-label="Fechar">×</button></header>
    <div class="dialog-body">${body}</div>
    ${form ? `<footer class="actions"><button class="btn" type="submit">${submit}</button><button type="button" class="btn secondary" data-action="close-dialog">Cancelar</button></footer>` : ""}
  </form>`;
  d.showModal();
  d.querySelector("input, select, textarea")?.focus();
}

function closeDialog() {
  if (dialog().open) dialog().close();
}

function proposalHTML(b) {
  const p = db.profile;
  const today = localDay();
  return `<div class="proposal">
    <header><div>${p.business || p.name ? `<strong>${esc(p.business || p.name)}</strong>` : ""}${p.business && p.name ? `<span>${esc(p.name)}</span>` : ""}</div>
    <span>${formatDay(today)}</span></header>
    <h1>Proposta comercial</h1>
    <dl>
      ${b.client ? `<dt>Para</dt><dd>${esc(b.client)}</dd>` : ""}
      <dt>Projeto</dt><dd>${esc(b.name)}</dd>
    </dl>
    ${b.scope ? `<h3>Escopo</h3><p class="scope">${esc(b.scope)}</p>` : ""}
    <div class="investment"><span>Investimento</span><strong>${money(b.price)}</strong></div>
    ${p.paymentTerms ? `<h3>Condições de pagamento</h3><p>${esc(p.paymentTerms)}</p>` : ""}
    ${p.validityDays ? `<p class="validity">Proposta válida até ${formatDay(addDays(today, Number(p.validityDays)))}.</p>` : ""}
    <footer>${[p.name, p.phone, p.email].filter(Boolean).map(esc).join(" · ")}</footer>
  </div>`;
}

function openProposal(id) {
  const b = db.budgets.find((x) => x.id === id);
  if (!b) return;
  const lead = leadByCompany(b.client);
  const text = proposalText(b, db.profile);
  const missing = !db.profile.name && !db.profile.business;
  openDialog({
    title: "Proposta",
    wide: true,
    body: `${missing ? `<p class="notice-inline">Complete <button type="button" class="link" data-page="settings">seu perfil</button> para a proposta sair com seu nome e contato.</p>` : ""}
      <div class="proposal-preview">${proposalHTML(b)}</div>
      <div class="actions section">
        <a class="btn" href="${esc(whatsappLink(text, lead?.contact))}" target="_blank" rel="noopener" data-action="sent:${b.id}">Enviar no WhatsApp${lead && phoneDigits(lead.contact) ? ` para ${esc(lead.company)}` : ""}</a>
        ${btn("Copiar texto", `copy-proposal:${b.id}`)}
        ${btn("Imprimir / salvar PDF", `print-proposal:${b.id}`)}
      </div>`,
  });
}

function markSent(id) {
  const b = db.budgets.find((x) => x.id === id);
  if (b && b.status === "Rascunho") {
    b.status = "Enviado";
    b.updated = new Date().toISOString();
    save();
    if (page === "budget") render();
  }
}

/* ================= Leitura de formulários ================= */

const num = (fd, key) => {
  const raw = fd.get(key);
  return raw === null || raw === "" ? NaN : Number(raw);
};
const text = (fd, key) => String(fd.get(key) ?? "").trim();

function readBudget(fd) {
  return {
    hours: num(fd, "hours"),
    rate: num(fd, "rate"),
    costs: num(fd, "costs"),
    buffer: num(fd, "buffer"),
    tax: num(fd, "tax"),
  };
}

function priceLabel(n) {
  return validBudgetNumbers(n)
    ? money(calcPrice(n.hours, n.rate, n.costs, n.buffer, n.tax))
    : "Confira os valores";
}

function budgetFromForm(fd) {
  const n = readBudget(fd);
  if (!validBudgetNumbers(n)) return null;
  return {
    ...n,
    name: text(fd, "name"),
    client: text(fd, "client"),
    scope: text(fd, "scope"),
    status: BUDGET_STATUS.includes(fd.get("status")) ? fd.get("status") : "Rascunho",
    price: calcPrice(n.hours, n.rate, n.costs, n.buffer, n.tax),
  };
}

function leadFromForm(fd) {
  return {
    company: text(fd, "company"),
    person: text(fd, "person"),
    contact: text(fd, "contact"),
    service: text(fd, "service"),
    value: Math.max(0, num(fd, "value") || 0),
    follow: /^\d{4}-\d{2}-\d{2}$/.test(fd.get("follow")) ? fd.get("follow") : "",
    notes: text(fd, "notes"),
  };
}

function setStage(lead, status) {
  if (!STAGES.includes(status) || lead.status === status) return;
  lead.status = status;
  lead.closedAt = status === "Fechado" ? new Date().toISOString() : null;
  lead.updated = new Date().toISOString();
}

/* ================= Ações dos formulários ================= */

const forms = {
  budget(form, fd) {
    const data = budgetFromForm(fd);
    if (!data) return notify("Confira os números do orçamento.");
    const now = new Date().toISOString();
    const b = { id: uid(), ...data, created: now, updated: now };
    db.budgets.push(b);
    delete drafts.budget;
    commit("Orçamento salvo!", { label: "Ver proposta", run: () => openProposal(b.id) });
  },
  "edit-budget"(form, fd) {
    const b = db.budgets.find((x) => x.id === form.dataset.id);
    const data = budgetFromForm(fd);
    if (!data) return notify("Confira os números do orçamento.");
    if (b) Object.assign(b, data, { updated: new Date().toISOString() });
    closeDialog();
    commit("Orçamento atualizado.");
  },
  list(form, fd) {
    db.lists.push({ id: uid(), name: text(fd, "name"), items: [], created: new Date().toISOString() });
    commit("Checklist criado!");
  },
  "edit-list"(form, fd) {
    const l = db.lists.find((x) => x.id === form.dataset.id);
    if (l) l.name = text(fd, "name");
    closeDialog();
    commit();
  },
  task(form, fd) {
    const l = db.lists.find((x) => x.id === form.dataset.list);
    if (!l) return;
    l.items.push({ id: uid(), text: text(fd, "text"), done: false });
    commit();
    $(`[data-form="task"][data-list="${l.id}"] input`)?.focus();
  },
  "edit-task"(form, fd) {
    const [listId, itemId] = form.dataset.id.split(":");
    const item = db.lists.find((x) => x.id === listId)?.items.find((x) => x.id === itemId);
    if (item) item.text = text(fd, "text");
    closeDialog();
    commit();
  },
  lead(form, fd) {
    const now = new Date().toISOString();
    const lead = {
      id: uid(),
      ...leadFromForm(fd),
      status: "Lead",
      closedAt: null,
      created: now,
      updated: now,
    };
    setStage(lead, fd.get("status"));
    db.leads.push(lead);
    delete drafts.lead;
    commit("Contato adicionado!");
  },
  "edit-lead"(form, fd) {
    const lead = db.leads.find((x) => x.id === form.dataset.id);
    if (lead) {
      Object.assign(lead, leadFromForm(fd), { updated: new Date().toISOString() });
      setStage(lead, fd.get("status"));
    }
    closeDialog();
    commit("Contato atualizado.");
  },
  profile(form, fd) {
    const n = (key, min, max, fallback) => {
      const v = num(fd, key);
      return Number.isFinite(v) && v >= min && v <= max ? v : fallback;
    };
    const p = db.profile;
    Object.assign(p, {
      name: text(fd, "name"),
      business: text(fd, "business"),
      email: text(fd, "email"),
      phone: text(fd, "phone"),
      defaultRate: n("defaultRate", 1, 100000, p.defaultRate),
      defaultBuffer: n("defaultBuffer", 0, 100, p.defaultBuffer),
      defaultTax: n("defaultTax", 0, 90, p.defaultTax),
      validityDays: Math.round(n("validityDays", 1, 365, p.validityDays)),
      paymentTerms: text(fd, "paymentTerms"),
    });
    delete drafts.budget; // os padrões novos valem para o próximo orçamento
    commit("Perfil salvo!");
  },
};

/* ================= Ações dos botões ================= */

const findList = (id) => db.lists.find((x) => x.id === id);

const actions = {
  "close-dialog": closeDialog,
  "clear-draft"(name) {
    delete drafts[name];
    render();
  },
  proposal: openProposal,
  sent: markSent,
  "edit-budget"(id) {
    const b = db.budgets.find((x) => x.id === id);
    if (b)
      openDialog({
        title: "Editar orçamento",
        form: "edit-budget",
        id,
        body: `${leadNamesDatalist()}<div class="form-grid">${budgetFields("edit", b)}</div>`,
      });
  },
  "dup-budget"(id) {
    const b = db.budgets.find((x) => x.id === id);
    if (!b) return;
    const now = new Date().toISOString();
    db.budgets.push({
      ...b,
      id: uid(),
      name: `${b.name} (cópia)`,
      status: "Rascunho",
      created: now,
      updated: now,
    });
    commit("Orçamento duplicado.");
  },
  "del-budget"(id) {
    removeWithUndo("Orçamento excluído.", () => (db.budgets = db.budgets.filter((x) => x.id !== id)));
  },
  async "copy-proposal"(id) {
    const b = db.budgets.find((x) => x.id === id);
    if (!b) return;
    try {
      await navigator.clipboard.writeText(proposalText(b, db.profile));
      markSent(id);
      notify("Proposta copiada!");
    } catch {
      notify("Não foi possível copiar. Use o botão do WhatsApp ou imprima.");
    }
  },
  "print-proposal"(id) {
    const b = db.budgets.find((x) => x.id === id);
    if (!b) return;
    $("#print").innerHTML = proposalHTML(b);
    closeDialog();
    markSent(id);
    window.print();
  },
  "edit-list"(id) {
    const l = findList(id);
    if (l)
      openDialog({
        title: "Renomear checklist",
        form: "edit-list",
        id,
        body: field("Nome", input("name", l.name, 'required maxlength="90"')),
      });
  },
  "del-list"(id) {
    removeWithUndo("Checklist excluído.", () => (db.lists = db.lists.filter((x) => x.id !== id)));
  },
  "edit-task"(listId, itemId) {
    const item = findList(listId)?.items.find((x) => x.id === itemId);
    if (item)
      openDialog({
        title: "Editar tarefa",
        form: "edit-task",
        id: `${listId}:${itemId}`,
        body: field("Tarefa", input("text", item.text, 'required maxlength="160"')),
      });
  },
  "del-task"(listId, itemId) {
    const l = findList(listId);
    if (l) removeWithUndo("Tarefa excluída.", () => (l.items = l.items.filter((x) => x.id !== itemId)));
  },
  "clear-done"(listId) {
    const l = findList(listId);
    if (l) removeWithUndo("Tarefas concluídas removidas.", () => (l.items = l.items.filter((x) => !x.done)));
  },
  "edit-lead"(id) {
    const l = db.leads.find((x) => x.id === id);
    if (l)
      openDialog({
        title: "Editar contato",
        form: "edit-lead",
        id,
        body: `<div class="form-grid">${leadFields("edit", l)}</div>`,
      });
  },
  "del-lead"(id) {
    removeWithUndo("Contato excluído.", () => (db.leads = db.leads.filter((x) => x.id !== id)));
  },
  "follow-done"(id) {
    const l = db.leads.find((x) => x.id === id);
    if (!l) return;
    const before = { follow: l.follow, status: l.status, updated: l.updated };
    l.follow = "";
    if (l.status === "Lead") setStage(l, "Contatado");
    l.updated = new Date().toISOString();
    commit("Retorno concluído. Defina o próximo em Editar.", {
      label: "Desfazer",
      run() {
        Object.assign(l, before);
        commit();
      },
    });
  },
  "follow-snooze"(id) {
    const l = db.leads.find((x) => x.id === id);
    if (!l) return;
    l.follow = addDays(localDay(), 2);
    l.updated = new Date().toISOString();
    commit(`Retorno adiado para ${formatDay(l.follow)}.`);
  },
  "filter-stage"(stage) {
    filters.stage = filters.stage === stage ? "" : stage;
    render();
  },
  "clear-filters"() {
    filters.stage = "";
    filters.q = "";
    render();
  },
  export: exportBackup,
  import() {
    $("#backup-file").click();
  },
  demo() {
    if (!isEmpty(db) && !confirm("Substituir os dados atuais pelos dados de exemplo?")) return;
    const theme = db.prefs.theme;
    db = demoData();
    db.prefs.theme = theme;
    commit("Dados de exemplo carregados. Apague em Seus dados quando quiser começar.");
  },
  reset() {
    if (!confirm("Apagar permanentemente todos os dados deste aparelho? Faça um backup antes.")) return;
    const theme = db.prefs.theme;
    db = emptyData();
    db.prefs.theme = theme;
    Object.keys(drafts).forEach((k) => delete drafts[k]);
    commit("Dados apagados.");
  },
};

function exportBackup() {
  const payload = { app: "LF Business", schema: db.schema, exportedAt: new Date().toISOString(), data: db };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lf-business-backup-${localDay()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  db.prefs.lastBackup = localDay();
  commit("Backup exportado!");
}

async function importBackup(file) {
  try {
    if (file.size > 5e6) throw new Error("Arquivo muito grande");
    const data = readBackup(JSON.parse(await file.text()));
    if (!data) throw new Error("Formato inválido");
    if (!confirm("Substituir todos os dados atuais pelo backup?")) return;
    data.prefs.theme = db.prefs.theme;
    db = data;
    applyTheme();
    commit("Backup restaurado!");
  } catch {
    notify("Não foi possível importar esse arquivo. Confira se é um backup do LF Business.");
  }
}

/* ================= Eventos (delegação) ================= */

document.addEventListener("submit", (e) => {
  const form = e.target.closest("form[data-form]");
  if (!form) return;
  e.preventDefault();
  forms[form.dataset.form]?.(form, new FormData(form));
});

document.addEventListener("input", (e) => {
  const form = e.target.closest("form");
  if (e.target.dataset.filter === "q") {
    filters.q = e.target.value;
    $("#lead-list").innerHTML = leadList();
    $("#clear-filters").classList.toggle("hidden", !filters.q && !filters.stage);
    return;
  }
  if (!form) return;
  if (form.hasAttribute("data-draft")) drafts[form.dataset.form] = Object.fromEntries(new FormData(form));
  const price = $("[data-price]", form);
  if (price) price.textContent = priceLabel(readBudget(new FormData(form)));
});

document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.check) {
    const [listId, itemId] = el.dataset.check.split(":");
    const item = findList(listId)?.items.find((x) => x.id === itemId);
    if (item) item.done = el.checked;
    commit();
  } else if (el.dataset.stage) {
    const lead = db.leads.find((x) => x.id === el.dataset.stage);
    if (lead) setStage(lead, el.value);
    commit(el.value === "Fechado" ? "Parabéns pelo fechamento! 🎉" : "");
  } else if (el.dataset.budgetStatus) {
    const b = db.budgets.find((x) => x.id === el.dataset.budgetStatus);
    if (b && BUDGET_STATUS.includes(el.value)) {
      b.status = el.value;
      b.updated = new Date().toISOString();
    }
    commit();
  } else if (el.hasAttribute("data-theme-select")) {
    db.prefs.theme = ["auto", "light", "dark"].includes(el.value) ? el.value : "auto";
    applyTheme();
    save();
  } else if (el.id === "backup-file" && el.files[0]) {
    importBackup(el.files[0]);
    el.value = "";
  }
});

document.addEventListener("click", (e) => {
  const nav = e.target.closest("[data-page]");
  if (nav) {
    closeDialog();
    go(nav.dataset.page);
    return;
  }
  const el = e.target.closest("[data-action]");
  if (!el) {
    // Clique no fundo escuro fora do diálogo fecha o diálogo.
    if (e.target === dialog()) closeDialog();
    return;
  }
  const [name, ...args] = el.dataset.action.split(":");
  if (el.tagName !== "A") e.preventDefault();
  actions[name]?.(...args);
});

window.addEventListener("popstate", () => {
  const next = location.hash.slice(1);
  page = PAGES[next] ? next : "home";
  render();
});

/* ================= Início ================= */

if (loaded.status === "ok") save(); // grava já no formato novo (migração v1 → v2)
applyTheme();
render();
if (loaded.status === "recovered")
  notify("Os dados salvos estavam ilegíveis. Guardamos uma cópia e começamos do zero.");
if (loaded.status === "unavailable") {
  $("#status").textContent = "⚠ Armazenamento indisponível";
  $("#status").classList.add("warn");
}

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
