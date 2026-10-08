import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calcPrice,
  validBudgetNumbers,
  esc,
  localDay,
  addDays,
  daysBetween,
  followUps,
  funnel,
  pipelineValue,
  wonInMonth,
  approvalRate,
  proposalText,
  phoneDigits,
  whatsappLink,
  migrate,
  readBackup,
  demoData,
  validData,
  SCHEMA,
} from "../js/lib.js";

describe("calcPrice", () => {
  test("horas × valor com reserva", () => {
    assert.equal(calcPrice(25, 75, 0, 20, 0), 2250);
    assert.equal(calcPrice(10, 100, 0, 20, 0), 1200);
  });
  test("imposto por dentro: sobra exatamente o valor desejado", () => {
    const price = calcPrice(10, 100, 0, 0, 10);
    assert.equal(price, 1111.11);
    assert.ok(Math.abs(price * 0.9 - 1000) < 0.01);
  });
  test("custos entram antes da reserva", () => {
    assert.equal(calcPrice(10, 100, 200, 10, 0), 1320);
  });
});

test("validBudgetNumbers recusa valores impossíveis", () => {
  const ok = { hours: 10, rate: 50, costs: 0, buffer: 20, tax: 6 };
  assert.equal(validBudgetNumbers(ok), true);
  assert.equal(validBudgetNumbers({ ...ok, hours: 0 }), false);
  assert.equal(validBudgetNumbers({ ...ok, tax: 95 }), false);
  assert.equal(validBudgetNumbers({ ...ok, rate: NaN }), false);
  assert.equal(validBudgetNumbers({ ...ok, costs: -1 }), false);
});

test("esc neutraliza HTML", () => {
  assert.equal(esc(`<img src=x onerror="a('b')">`), "&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;");
  assert.equal(esc(null), "");
});

describe("datas", () => {
  test("localDay usa o dia local, não UTC", () => {
    assert.equal(localDay(new Date(2026, 9, 8, 23, 30)), "2026-10-08");
  });
  test("addDays vira o mês e o ano", () => {
    assert.equal(addDays("2026-10-30", 3), "2026-11-02");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });
  test("daysBetween", () => {
    assert.equal(daysBetween("2026-10-08", "2026-10-11"), 3);
    assert.equal(daysBetween("2026-10-08", "2026-10-06"), -2);
  });
});

describe("prospecção", () => {
  const today = "2026-10-08";
  const leads = [
    { id: "a", status: "Lead", follow: "2026-10-05", value: 100 },
    { id: "b", status: "Proposta", follow: "2026-10-08", value: 2000 },
    { id: "c", status: "Negociação", follow: "2026-10-12", value: 500.5 },
    { id: "d", status: "Contatado", follow: "2026-10-30", value: 0 },
    {
      id: "e",
      status: "Fechado",
      follow: "2026-10-01",
      value: 900,
      closedAt: new Date(2026, 9, 3).toISOString(),
    },
    { id: "f", status: "Perdido", follow: "2026-10-08", value: 50 },
    { id: "g", status: "Fechado", value: 300, closedAt: new Date(2026, 8, 20).toISOString() },
  ];

  test("followUps separa atrasados, hoje e próximos 7 dias, ignorando fechados", () => {
    const f = followUps(leads, today);
    assert.deepEqual(
      f.overdue.map((l) => l.id),
      ["a"],
    );
    assert.deepEqual(
      f.today.map((l) => l.id),
      ["b"],
    );
    assert.deepEqual(
      f.upcoming.map((l) => l.id),
      ["c"],
    );
  });

  test("valor em negociação soma Proposta e Negociação", () => {
    assert.equal(pipelineValue(leads), 2500.5);
  });

  test("fechado no mês considera só o mês atual", () => {
    assert.equal(wonInMonth(leads, new Date(2026, 9, 8)), 900);
  });

  test("funil tem as 7 etapas na ordem", () => {
    const f = funnel(leads);
    assert.equal(f.length, 7);
    assert.deepEqual(
      f.find((s) => s.stage === "Fechado"),
      { stage: "Fechado", count: 2, value: 1200 },
    );
  });
});

test("approvalRate ignora orçamentos sem resposta", () => {
  assert.equal(approvalRate([]), null);
  assert.equal(approvalRate([{ status: "Enviado" }]), null);
  assert.equal(
    approvalRate([
      { status: "Aprovado" },
      { status: "Recusado" },
      { status: "Aprovado" },
      { status: "Rascunho" },
    ]),
    67,
  );
});

describe("proposta e WhatsApp", () => {
  const profile = {
    name: "Lavínia",
    business: "LF Soluções",
    phone: "21 9",
    email: "",
    paymentTerms: "50/50",
    validityDays: 10,
  };
  const budget = { name: "Site", client: "Clínica", scope: "5 páginas", price: 2250 };

  test("texto da proposta tem cliente, escopo, preço e validade", () => {
    const t = proposalText(budget, profile, "2026-10-08");
    assert.match(t, /LF Soluções/);
    assert.match(t, /Olá, Clínica!/);
    assert.match(t, /5 páginas/);
    assert.match(t, /R\$\s2\.250,00/);
    assert.match(t, /até 18\/10\/2026/);
  });

  test("phoneDigits reconhece celular brasileiro em texto livre", () => {
    assert.equal(phoneDigits("WhatsApp (21) 99999-0000"), "5521999990000");
    assert.equal(phoneDigits("+55 21 99999-0000"), "5521999990000");
    assert.equal(phoneDigits("contato@empresa.com"), null);
    assert.equal(phoneDigits(undefined), null);
  });

  test("whatsappLink codifica o texto", () => {
    assert.equal(whatsappLink("a b&c", "(21) 99999-0000"), "https://wa.me/5521999990000?text=a%20b%26c");
    assert.equal(whatsappLink("oi"), "https://wa.me/?text=oi");
  });
});

describe("migração de dados", () => {
  const v1 = {
    budgets: [
      {
        id: "1",
        name: "X",
        hours: 1,
        rate: 1,
        costs: 0,
        buffer: 0,
        tax: 0,
        price: 1,
        created: "2026-10-01T00:00:00Z",
      },
    ],
    lists: [{ id: "l", name: "L", items: [{ id: "i", text: "t", done: false }] }],
    leads: [{ id: "d", company: "C", status: "Fechado", created: "2026-10-02T00:00:00Z" }],
  };

  test("v1 vira v2 sem perder nada", () => {
    const d = migrate(v1);
    assert.equal(d.schema, SCHEMA);
    assert.equal(d.budgets[0].name, "X");
    assert.equal(d.budgets[0].status, "Rascunho");
    assert.equal(d.leads[0].closedAt, "2026-10-02T00:00:00Z");
    assert.equal(d.lists[0].items.length, 1);
    assert.equal(d.profile.defaultRate, 75);
  });

  test("migrar duas vezes dá o mesmo resultado", () => {
    const once = migrate(v1);
    assert.deepEqual(migrate(once), once);
  });

  test("recusa formatos desconhecidos ou de versão futura", () => {
    assert.equal(migrate(null), null);
    assert.equal(migrate({ budgets: [] }), null);
    assert.equal(migrate({ ...v1, schema: SCHEMA + 1 }), null);
    assert.equal(migrate({ ...v1, lists: [{ name: "sem items" }] }), null);
  });

  test("etapa inválida volta para Lead", () => {
    const d = migrate({ ...v1, leads: [{ id: "x", company: "Y", status: "Hackeado" }] });
    assert.equal(d.leads[0].status, "Lead");
  });

  test("readBackup aceita backups v1 e v2", () => {
    assert.ok(readBackup({ schema: 1, data: v1 }));
    assert.ok(readBackup({ schema: 2, data: migrate(v1) }));
    assert.equal(readBackup({ schema: 1 }), null);
    assert.equal(readBackup("texto"), null);
  });
});

test("dados de exemplo são válidos", () => {
  const d = demoData("2026-10-08");
  assert.ok(validData(d));
  assert.deepEqual(migrate(d), d);
});
