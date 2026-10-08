(() => {
  "use strict";
  const KEY = "lf-business-v1";
  const initial = () => ({ budgets: [], lists: [], leads: [] });
  let db;
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    db =
      v &&
      Array.isArray(v.budgets) &&
      Array.isArray(v.lists) &&
      Array.isArray(v.leads)
        ? v
        : initial();
  } catch {
    db = initial();
  }
  let page = "home";
  const $ = (s) => document.querySelector(s),
    money = (n) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Number(n) || 0),
    date = (s) => new Date(s).toLocaleDateString("pt-BR"),
    id = () =>
      crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now() + Math.random()),
    esc = (s) =>
      String(s ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      notify(
        "Não foi possível salvar. Verifique o armazenamento do navegador.",
      );
    }
  };
  function notify(message) {
    const el = $("#toast");
    el.textContent = message;
    el.style.display = "block";
    clearTimeout(notify.timeout);
    notify.timeout = setTimeout(() => (el.style.display = "none"), 3200);
  }
  const btn = (label, action, kind = "secondary") =>
    `<button class="btn ${kind}" data-action="${action}">${label}</button>`;
  const empty = (msg) => `<div class="empty">${msg}</div>`;
  function render() {
    document
      .querySelectorAll(".nav")
      .forEach((n) => n.classList.toggle("active", n.dataset.page === page));
    const titles = {
      home: "Visão geral",
      budget: "Calculadora de orçamentos",
      tasks: "Checklists",
      leads: "Prospecção de clientes",
      settings: "Seus dados",
    };
    $("#page-title").textContent = titles[page];
    $("#content").innerHTML = { home, budget, tasks, leads, settings }[page]();
  }
  function home() {
    const total = db.lists.reduce((n, l) => n + l.items.length, 0),
      completed = db.lists.reduce(
        (n, l) => n + l.items.filter((i) => i.done).length,
        0,
      ),
      open = db.leads.filter(
        (l) => !["Fechado", "Perdido"].includes(l.status),
      ).length;
    return `<div class="grid"><div class="panel"><span class="eyebrow">ORÇAMENTOS SALVOS</span><div class="metric">${db.budgets.length}</div><p class="muted">Propostas calculadas</p></div><div class="panel"><span class="eyebrow">TAREFAS CONCLUÍDAS</span><div class="metric">${completed}/${total}</div><div class="progress"><span style="width:${total ? (100 * completed) / total : 0}%"></span></div></div><div class="panel"><span class="eyebrow">CONTATOS EM ABERTO</span><div class="metric">${open}</div><p class="muted">De ${db.leads.length} contatos cadastrados</p></div></div><section class="section panel"><h2>Seu próximo passo</h2><p class="muted">Faça um orçamento, organize as entregas ou acompanhe um possível cliente. Tudo fica salvo automaticamente neste dispositivo.</p><div class="actions">${btn("Novo orçamento", "goto-budget", "")}${btn("Novo checklist", "goto-tasks")}${btn("Adicionar contato", "goto-leads")}</div></section>`;
  }
  function calcPrice(h, r, c, b, t) {
    const base = h * r + c;
    return Math.round(((base * (1 + b / 100)) / (1 - t / 100)) * 100) / 100;
  }
  function budget() {
    return `<div class="grid two"><div class="panel"><h2>Calcular valor</h2><form id="budget-form" class="form-grid"><label class="field span-all">Nome do projeto<input name="name" required maxlength="100" placeholder="Ex.: Landing page para clínica"></label><label class="field">Horas estimadas<input name="hours" type="number" min="0.5" max="10000" step="0.5" value="25" required></label><label class="field">Valor por hora (R$)<input name="rate" type="number" min="1" max="100000" step="1" value="75" required></label><label class="field">Custos adicionais (R$)<input name="costs" type="number" min="0" max="10000000" step="0.01" value="0" required></label><label class="field">Reserva para imprevistos (%)<input name="buffer" type="number" min="0" max="100" step="1" value="20" required></label><label class="field span-all">Reserva para impostos/taxas sobre o preço final (%)<input name="tax" type="number" min="0" max="90" step="0.5" value="0" required></label><div class="span-all result"><small>PREÇO ESTIMADO</small><br><strong id="price">R$ 2.250,00</strong><p class="hint">Referência de orçamento, não lucro líquido. Confirme o regime tributário e os custos reais antes de apresentar uma proposta.</p></div><div class="actions span-all"><button class="btn" type="submit">Salvar orçamento</button>${btn("Copiar resumo", "copy-budget")}</div></form></div><div class="panel"><h2>Histórico</h2><div class="list">${
      db.budgets.length
        ? db.budgets
            .slice()
            .reverse()
            .map(
              (b) =>
                `<div class="item"><div class="item-body"><strong>${esc(b.name)}</strong><p>${date(b.created)} · ${b.hours}h × ${money(b.rate)}/h</p><strong>${money(b.price)}</strong></div>${btn("Excluir", "delete-budget:" + b.id, "danger small")}</div>`,
            )
            .join("")
        : empty("Nenhum orçamento salvo ainda.")
    }</div></div></div>`;
  }
  const listItems = (l) => l.items.filter((i) => i.done).length;
  function tasks() {
    return `<section class="panel"><div class="section-head"><h2>Seus checklists</h2></div><form id="list-form" class="actions"><label class="field" style="flex:1;min-width:190px"><span>Novo checklist</span><input name="name" required maxlength="90" placeholder="Ex.: Entrega Mary Bless"></label><button class="btn" type="submit">Criar lista</button></form></section><div class="grid two section">${db.lists.length ? db.lists.map((l) => `<article class="panel"><div class="section-head"><div><h2>${esc(l.name)}</h2><p class="hint">${listItems(l)} de ${l.items.length} concluídas</p></div>${btn("Excluir lista", "delete-list:" + l.id, "danger small")}</div><div class="progress"><span style="width:${l.items.length ? (100 * listItems(l)) / l.items.length : 0}%"></span></div><div class="list section">${l.items.map((i) => `<div class="item"><label class="checkline item-body"><input type="checkbox" data-check-list="${l.id}" data-check-item="${i.id}" ${i.done ? "checked" : ""}><span class="${i.done ? "done" : ""}">${esc(i.text)}</span></label>${btn("×", "delete-task:" + l.id + ":" + i.id, "secondary small")}</div>`).join("")}</div><form class="add-task actions section" data-list="${l.id}"><input aria-label="Nova tarefa" name="text" required maxlength="160" placeholder="Adicionar tarefa" style="flex:1;min-width:130px;border:1px solid #ddd1c9;border-radius:9px;padding:10px"><button class="btn small">Adicionar</button></form></article>`).join("") : empty("Crie seu primeiro checklist para acompanhar as entregas.")}</div>`;
  }
  const stages = [
    "Lead",
    "Contatado",
    "Reunião",
    "Proposta",
    "Negociação",
    "Fechado",
    "Perdido",
  ];
  function leads() {
    return `<section class="panel"><h2>Novo contato</h2><form id="lead-form" class="form-grid"><label class="field">Empresa / contato<input name="company" required maxlength="100" placeholder="Nome da empresa"></label><label class="field">Pessoa de contato<input name="person" maxlength="90" placeholder="Opcional"></label><label class="field">Canal / telefone / e-mail<input name="contact" maxlength="200" placeholder="WhatsApp, e-mail, LinkedIn..."></label><label class="field">Serviço de interesse<input name="service" maxlength="120" placeholder="Site, loja, automação..."></label><label class="field">Valor potencial (R$)<input name="value" type="number" step="0.01" min="0" max="100000000" placeholder="Opcional"></label><label class="field">Próximo contato<input name="follow" type="date"></label><label class="field span-all">Observações<textarea name="notes" maxlength="1000" placeholder="Necessidades identificadas, proposta e próximos passos"></textarea></label><div class="span-all"><button class="btn">Adicionar ao CRM</button></div></form></section><section class="section"><div class="section-head"><h2>Funil de prospecção</h2><span class="tag">${db.leads.length} contatos</span></div><div class="list">${
      db.leads.length
        ? db.leads
            .slice()
            .reverse()
            .map(
              (l) =>
                `<article class="item"><div class="item-body"><strong>${esc(l.company)}</strong> <span class="chip">${esc(l.status)}</span><p>${esc(l.person)} ${l.person && l.contact ? "·" : ""} ${esc(l.contact)}</p><p>${esc(l.service)} ${l.value ? "· " + money(l.value) : ""}</p>${l.follow ? `<p>Próximo contato: ${esc(l.follow.split("-").reverse().join("/"))}</p>` : ""}${l.notes ? `<p>${esc(l.notes)}</p>` : ""}</div><div class="lead-controls"><label class="field">Etapa<select data-stage="${l.id}">${stages.map((s) => `<option ${l.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>${btn("Excluir", "delete-lead:" + l.id, "danger small")}</div></article>`,
            )
            .join("")
        : empty("Adicione empresas e acompanhe cada conversa.")
    }</div></section>`;
  }
  function settings() {
    return `<div class="grid two"><div class="panel"><h2>Backup dos seus dados</h2><p class="muted">Exporte um arquivo JSON para restaurar seus orçamentos, checklists e contatos em outro aparelho.</p><div class="actions">${btn("Exportar backup", "export", "")}${btn("Importar backup", "import")}</div><input class="hidden" type="file" id="backup-file" accept="application/json,.json"><p class="hint">Importar substitui os dados atuais. Faça um backup antes.</p></div><div class="panel"><h2>Privacidade e uso offline</h2><p class="muted">Nesta primeira versão não há contas nem sincronização. Os dados ficam no armazenamento do navegador, podem ser apagados pelo próprio navegador e não são enviados a um servidor.</p><p class="hint">Para instalar: abra a versão publicada por HTTPS e use “Instalar aplicativo” ou “Adicionar à tela inicial” no navegador.</p>${btn("Apagar todos os dados", "reset", "danger")}</div></div>`;
  }
  function number(form, key) {
    return Number(new FormData(form).get(key));
  }
  function updatePrice() {
    const f = $("#budget-form");
    if (!f) return;
    const h = number(f, "hours"),
      r = number(f, "rate"),
      c = number(f, "costs"),
      b = number(f, "buffer"),
      t = number(f, "tax");
    $("#price").textContent =
      [h, r, c, b, t].every(Number.isFinite) &&
      h > 0 &&
      r > 0 &&
      c >= 0 &&
      b >= 0 &&
      t >= 0 &&
      t < 100
        ? money(calcPrice(h, r, c, b, t))
        : "Confira os valores";
  }
  function exportFile() {
    const blob = new Blob(
        [
          JSON.stringify(
            { schema: 1, exportedAt: new Date().toISOString(), data: db },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "lf-business-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function validData(d) {
    return (
      d &&
      ["budgets", "lists", "leads"].every((k) => Array.isArray(d[k])) &&
      d.budgets.length < 10000 &&
      d.lists.length < 10000 &&
      d.leads.length < 10000 &&
      d.lists.every((l) => Array.isArray(l.items) && l.items.length < 10000)
    );
  }
  $("#content").addEventListener("input", (e) => {
    if (e.target.closest("#budget-form")) updatePrice();
  });
  $("#content").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target,
      fd = new FormData(f);
    if (f.id === "budget-form") {
      const h = number(f, "hours"),
        r = number(f, "rate"),
        c = number(f, "costs"),
        b = number(f, "buffer"),
        t = number(f, "tax");
      if (!(
        h > 0 &&
        r > 0 &&
        c >= 0 &&
        b >= 0 &&
        b <= 100 &&
        t >= 0 &&
        t <= 90
      ))
        return notify("Confira os números do orçamento.");
      db.budgets.push({
        id: id(),
        name: String(fd.get("name")).trim(),
        hours: h,
        rate: r,
        costs: c,
        buffer: b,
        tax: t,
        price: calcPrice(h, r, c, b, t),
        created: new Date().toISOString(),
      });
      save();
      render();
      notify("Orçamento salvo!");
    } else if (f.id === "list-form") {
      db.lists.push({
        id: id(),
        name: String(fd.get("name")).trim(),
        items: [],
      });
      save();
      render();
      notify("Checklist criado!");
    } else if (f.classList.contains("add-task")) {
      const l = db.lists.find((x) => x.id === f.dataset.list);
      if (l)
        l.items.push({
          id: id(),
          text: String(fd.get("text")).trim(),
          done: false,
        });
      save();
      render();
    } else if (f.id === "lead-form") {
      db.leads.push({
        id: id(),
        company: String(fd.get("company")).trim(),
        person: String(fd.get("person")),
        contact: String(fd.get("contact")),
        service: String(fd.get("service")),
        value: Number(fd.get("value")) || 0,
        follow: String(fd.get("follow")),
        notes: String(fd.get("notes")),
        status: "Lead",
        created: new Date().toISOString(),
      });
      save();
      render();
      notify("Contato registrado!");
    }
  });
  $("#content").addEventListener("change", (e) => {
    const n = e.target;
    if (n.dataset.checkList) {
      const l = db.lists.find((x) => x.id === n.dataset.checkList),
        i = l?.items.find((x) => x.id === n.dataset.checkItem);
      if (i) i.done = n.checked;
      save();
      render();
    }
    if (n.dataset.stage) {
      const l = db.leads.find((x) => x.id === n.dataset.stage);
      if (l && stages.includes(n.value)) l.status = n.value;
      save();
      render();
    }
  });
  $("#content").addEventListener("click", async (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const [action, a, b] = el.dataset.action.split(":");
    if (action.startsWith("goto-")) {
      page = action.slice(5);
      render();
      return;
    }
    if (action === "delete-budget" && confirm("Excluir este orçamento?"))
      db.budgets = db.budgets.filter((x) => x.id !== a);
    else if (
      action === "delete-list" &&
      confirm("Excluir este checklist e suas tarefas?")
    )
      db.lists = db.lists.filter((x) => x.id !== a);
    else if (action === "delete-task") {
      const l = db.lists.find((x) => x.id === a);
      if (l) l.items = l.items.filter((x) => x.id !== b);
    } else if (action === "delete-lead" && confirm("Excluir este contato?"))
      db.leads = db.leads.filter((x) => x.id !== a);
    else if (action === "export") {
      exportFile();
      return;
    } else if (action === "import") {
      $("#backup-file").click();
      return;
    } else if (action === "reset") {
      if (confirm("Apagar permanentemente todos os dados deste dispositivo?")) {
        db = initial();
        save();
        render();
        notify("Dados apagados");
      }
      return;
    } else if (action === "copy-budget") {
      const f = $("#budget-form");
      const data = new FormData(f);
      const text = `Projeto: ${data.get("name") || "Sem nome"}\nHoras: ${data.get("hours")}h\nValor/hora: ${money(data.get("rate"))}\nCustos: ${money(data.get("costs"))}\nReserva: ${data.get("buffer")}%\nTaxas: ${data.get("tax")}%\nEstimativa: ${$("#price").textContent}`;
      try {
        await navigator.clipboard.writeText(text);
        notify("Resumo copiado!");
      } catch {
        notify("Cópia indisponível: use HTTPS ou copie manualmente.");
      }
      return;
    } else return;
    save();
    render();
  });
  $("#content").addEventListener("change", async (e) => {
    if (e.target.id !== "backup-file") return;
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 5e6) throw Error("Arquivo muito grande");
      const parsed = JSON.parse(await file.text());
      if (!validData(parsed.data) || parsed.schema !== 1)
        throw Error("Formato inválido");
      if (confirm("Substituir todos os dados atuais pelo backup?")) {
        db = parsed.data;
        save();
        render();
        notify("Backup restaurado!");
      }
    } catch {
      notify("Não foi possível importar esse backup.");
    }
  });
  document.querySelectorAll(".nav").forEach((n) =>
    n.addEventListener("click", () => {
      page = n.dataset.page;
      render();
    }),
  );
  render();
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol))
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("./sw.js").catch(() => {}),
    );
})();
