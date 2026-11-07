# 🇯🇵 Japão 2027

Roteiro da viagem de Matheus & Monique ao Japão (08 a 28/01/2027), publicado como um site estático no estilo Notion — funciona em desktop, tablet e celular.

## Como editar o roteiro

Todo o conteúdo fica em **`content/roteiro.md`** (Markdown). Edite o arquivo, faça commit e o Vercel publica de novo sozinho.

- `- [ ]` / `- [x]` viram caixinhas clicáveis (o estado fica salvo no navegador de quem marcar)
- Linhas com `>` viram *callouts*; a cor segue o emoji do começo (🔴 vermelho, ⚠️ laranja, 💡 amarelo, ✅ verde…)
- Títulos `#` e `##` entram automaticamente no menu lateral
- Links do Google Maps viram botões

## Rodar localmente

```bash
npm install
npm run build      # gera public/index.html
npm run dev        # build + servidor local
```

## Estrutura

| Arquivo | O que é |
|---|---|
| `content/roteiro.md` | o conteúdo do roteiro |
| `scripts/build.mjs` | converte o Markdown em `public/index.html` |
| `src/styles.css` | visual (claro/escuro, responsivo) |
| `src/app.js` | menu, busca, tema, tarefas, contagem regressiva |
| `vercel.json` | configuração do deploy |
