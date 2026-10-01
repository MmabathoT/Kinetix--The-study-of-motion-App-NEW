const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webDirectory = path.join(root, 'www');
const files = [
  'index.html',
  'style.css',
  'script.js',
  'live-share.js',
  'Kinetix Logo running.png',
  'Kinetix Slogan.png'
];

fs.mkdirSync(webDirectory, { recursive: true });
fs.mkdirSync(path.join(webDirectory, 'assets'), { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(webDirectory, file));
}

fs.copyFileSync(path.join(root, 'assets', 'icon-only.png'), path.join(webDirectory, 'assets', 'icon-only.png'));
fs.copyFileSync(path.join(root, 'server', 'live-viewer.css'), path.join(webDirectory, 'live-viewer.css'));
fs.copyFileSync(path.join(root, 'server', 'live-viewer.js'), path.join(webDirectory, 'live-viewer.js'));
