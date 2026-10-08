# LF Business — MVP PWA

**Online:** https://lf-business-lake.vercel.app

PWA independente e sem backend, com calculadora de orçamentos, histórico, checklists persistentes e funil de prospecção. Interface em português e layout responsivo.

## Rodar localmente

Requer apenas um servidor estático (não abra `index.html` com `file://`):

```bash
python3 -m http.server 8080
```

Acesse `http://localhost:8080` e teste. No celular, para instalar via PWA, publique esta pasta em um serviço de hospedagem estática com HTTPS (ex.: Vercel ou Netlify). O service worker armazena os arquivos para acesso offline após a primeira visita online.

## Publicação na Vercel

O projeto está publicado na Vercel como site estático (Framework Preset: **Other**, sem comando de build, diretório de saída = raiz). Para publicar uma nova versão:

1. Aumente a versão do cache em `sw.js` (`lf-business-v1` → `lf-business-v2`), senão quem já instalou continua vendo a versão antiga.
2. Faça commit e push.
3. Rode `vercel deploy --prod` na raiz do projeto.

A pasta `.vercel/` é local e nunca deve ser commitada (já está no `.gitignore`).

## Privacidade

Todos os dados são salvos no `localStorage` do navegador: não há autenticação nem sincronização entre dispositivos. Use **Seus dados → Exportar backup** regularmente. Limpar os dados do navegador pode apagar tudo. Orçamentos são apenas estimativas comerciais, não aconselhamento tributário.

## Estrutura

`index.html`, `style.css`, `app.js`, `manifest.webmanifest`, `sw.js`, `icons/`.
