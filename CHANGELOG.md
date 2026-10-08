# Changelog

## 2.0.0 — 08/10/2026

### Novidades
- Editar orçamentos, contatos, checklists e tarefas.
- Orçamento com cliente, escopo e situação (Rascunho, Enviado, Aprovado, Recusado); duplicar orçamento.
- Proposta comercial: WhatsApp com o número do cliente, copiar texto e imprimir/salvar PDF.
- Retornos agendados na Visão geral (atrasados, hoje, próximos 7 dias) com **Feito** e **Adiar 2 dias**.
- Funil de prospecção com contagem e valor por etapa, filtro por etapa e busca.
- Novos indicadores: valor em negociação, fechado no mês e taxa de aprovação.
- Perfil com valores padrão e condições de pagamento.
- Tema escuro (automático, claro ou escuro).
- Excluir com Desfazer.
- Lembrete de backup e dados de exemplo para conhecer o app.
- Atalhos do app instalado (Novo orçamento, Prospecção) e endereço por tela (`#budget`, `#leads`…).

### Melhorias técnicas
- Código separado em módulos (`lib`, `store`, `app`) e 26 testes automatizados.
- Migração automática dos dados da versão 1, sem perda.
- Service worker *network first*: atualizações chegam sem precisar limpar o cache.
- CI no GitHub Actions.
- Acessibilidade: link "Pular para o conteúdo", foco visível, `aria-current` no menu.

## 1.0.0 — 08/10/2026

- Primeira versão: calculadora de orçamentos, checklists, funil de prospecção, backup em JSON e PWA offline.
