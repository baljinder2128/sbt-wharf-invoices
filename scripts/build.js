// Builds the two web pages from app/app.html (the shared app, also published as a Claude artifact):
//   docs/index.html   - GitHub Pages version, data in Firebase (free plan)
//   public/index.html - server version, data in this repo's Node server
// Run after changing app/app.html:  npm run build
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app', 'app.html'), 'utf8')
  .replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
  .replace('<title>Wharf Invoices</title>', '<title>SB Truckin · Wharf Invoices</title>');
const split = src.indexOf('<header class="mast">');
const top = src.slice(0, split);
const body = src.slice(split);

const FIREBASE = '10.12.2';
const page = (base, extraHead) => `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#15181c">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<link rel="manifest" href="${base}manifest.webmanifest">
<link rel="icon" href="${base}icons/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="${base}icons/icon-192.png">
<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
${extraHead}
${top}</head>
<body>
${body}
<script>if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('${base}sw.js').catch(() => {}));</script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'public', 'index.html'), page('/', '<script>window.WHARF_SERVER = true;</script>'));
fs.writeFileSync(path.join(root, 'docs', 'index.html'), page('./', [
  `<script src="https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-app-compat.js"></script>`,
  `<script src="https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-auth-compat.js"></script>`,
  `<script src="https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-firestore-compat.js"></script>`,
  '<script src="./config.js"></script>',
].join('\n')));
console.log('Built public/index.html and docs/index.html');
