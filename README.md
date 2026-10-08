# LF Business

**Orçamentos, propostas e prospecção de clientes para freelancers.** Um Progressive Web App que funciona offline, instala no celular e não precisa de cadastro.

**▶ Usar agora:** https://lf-business-lake.vercel.app (em *Visão geral*, toque em **Ver com dados de exemplo** para conhecer sem digitar nada)

![CI](https://github.com/v1ih/lf-business/actions/workflows/ci.yml/badge.svg)

## O que ele resolve

| Pergunta do dia a dia | Onde o app responde |
| --- | --- |
| Quanto eu cobro por este projeto? | **Orçamentos:** calculadora com reserva para imprevistos e imposto "por dentro" |
| Como mando a proposta? | **Proposta** pronta para WhatsApp (já com o número do cliente), texto ou PDF |
| Com quem eu preciso falar hoje? | **Retornos agendados:** atrasados, hoje e próximos 7 dias |
| Quanto tenho para fechar? | **Funil:** valor em proposta e negociação, fechado no mês, taxa de aprovação |
| O que falta entregar? | **Checklists** por cliente, com progresso |

## Funcionalidades

- Calculadora de preço ao vivo: `(horas × valor/hora + custos) × (1 + reserva) ÷ (1 − imposto)`.
- Orçamentos com cliente, escopo e situação (Rascunho → Enviado → Aprovado/Recusado); editar e duplicar.
- Proposta com a sua marca: envio pelo WhatsApp, cópia do texto ou impressão/PDF. Ao enviar, o orçamento passa sozinho para *Enviado*.
- Mini-CRM com 7 etapas, busca, filtro por etapa, valor potencial e data do próximo contato.
- Visão geral com retornos atrasados e do dia, botões **Feito** e **Adiar 2 dias**.
- Excluir com **Desfazer**, sem caixas de confirmação para tudo.
- Perfil com valores padrão (hora, reserva, impostos, validade e condições de pagamento).
- Tema claro, escuro ou automático.
- Backup e restauração em JSON, com lembrete semanal.
- Funciona offline e instala no Android, iPhone e computador.

## Decisões técnicas

- **Sem framework e sem build.** HTML, CSS e JavaScript puro com ES Modules. Zero dependências em produção.
- **Local-first.** Os dados ficam no `localStorage` do aparelho: nada é enviado a servidor. O formato é versionado (`schema: 2`) e o app migra automaticamente os dados da versão 1.
- **Estado único + render.** Um objeto `db` é a única fonte da verdade; toda ação muda o `db`, salva e redesenha a tela.
- **Segurança.** Todo texto do usuário passa por `esc()` antes de entrar no HTML (proteção contra XSS). Backups importados são validados antes de serem aceitos.
- **Offline com atualização automática.** O service worker usa *network first*: com internet busca a versão nova; sem internet usa o cache.
- **Regras de negócio puras e testadas.** `js/lib.js` não toca na tela nem no armazenamento, o que permite testar com o test runner nativo do Node.

## Estrutura

```
index.html            moldura da página (menu, cabeçalho, diálogo, área de impressão)
style.css             visual com tokens de cor, tema escuro, responsivo e impressão
js/app.js             interface: telas, diálogos e eventos
js/lib.js             regras de negócio puras (preço, funil, retornos, proposta, migração)
js/store.js           leitura e gravação no localStorage
sw.js                 service worker (offline)
manifest.webmanifest  dados do app instalável
tests/                testes automatizados (node:test)
```

## Rodar localmente

Precisa só do Node.js 20 ou mais novo:

```bash
npm start   # http://localhost:8088
npm test    # 26 testes
```

Não abra o `index.html` com dois cliques: módulos e service worker só funcionam via `http://`.

## Deploy

A Vercel publica automaticamente cada push na branch `main` (site estático, sem build). O GitHub Actions roda os testes em cada push e Pull Request.

## Privacidade

Não há contas nem servidor. Limpar os dados do navegador apaga tudo, por isso o app lembra de exportar um backup. Os valores calculados são estimativas comerciais, não aconselhamento tributário.

---

Feito por **Lavínia Ferraz** · [GitHub](https://github.com/v1ih)
