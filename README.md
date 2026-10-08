# LF Business — MVP PWA

PWA independente e sem backend, com calculadora de orçamentos, histórico, checklists persistentes e funil de prospecção. Interface em português e layout responsivo.

## Rodar localmente

Requer apenas um servidor estático (não abra `index.html` com `file://`):

```bash
python3 -m http.server 8080
```

Acesse `http://localhost:8080` e teste. No celular, para instalar via PWA, publique esta pasta em um serviço de hospedagem estática com HTTPS (ex.: Vercel ou Netlify). O service worker armazena os arquivos para acesso offline após a primeira visita online.

## Publicação na Vercel

Crie um novo projeto, importando esta pasta como repositório GitHub separado ou enviando-a à sua hospedagem de arquivos estáticos. Framework Preset: **Other**. Sem comando de build; diretório de saída: a raiz deste projeto.

## Privacidade

Todos os dados são salvos no `localStorage` do navegador: não há autenticação nem sincronização entre dispositivos. Use **Seus dados → Exportar backup** regularmente. Limpar os dados do navegador pode apagar tudo. Orçamentos são apenas estimativas comerciais, não aconselhamento tributário.

## Estrutura

`index.html`, `style.css`, `app.js`, `manifest.webmanifest`, `sw.js`, `icons/`.
