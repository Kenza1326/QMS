const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const binary = fs.existsSync(chromePath) ? chromePath : edgePath;
const htmlPath = path.resolve(__dirname, 'public', 'guide_test_equipe.html');
const pdfPath = path.resolve(__dirname, 'GUIDE_TEST_EQUIPE.pdf');
const publicPdfPath = path.resolve(__dirname, 'public', 'GUIDE_TEST_EQUIPE.pdf');

console.log('Rendering PDF using:', binary);
console.log('Source HTML:', htmlPath);
console.log('Target PDF:', pdfPath);

try {
  execFileSync(binary, [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    htmlPath,
  ]);
  console.log('PDF successfully created at:', pdfPath);
  fs.copyFileSync(pdfPath, publicPdfPath);
  console.log('PDF copied to public directory at:', publicPdfPath);
} catch (err) {
  console.error('Error generating PDF:', err);
  process.exit(1);
}
