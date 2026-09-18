const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webDirectory = path.join(root, 'www');
const files = [
  'index.html',
  'style.css',
  'script.js',
  'Kinetix Logo running.png',
  'Kinetix Slogan.png'
];

fs.mkdirSync(webDirectory, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(webDirectory, file));
}