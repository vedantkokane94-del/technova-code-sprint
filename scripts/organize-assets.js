import fs from 'fs';
import path from 'path';

const map = {
  'hub-logo.png': 'extracted_2_FormXob.94d2dca322866e082e669daeb15407f7_1000x1000.png',
  'signature-technical-secretary.png': 'extracted_1_FormXob.2176f07769fdbcd0737dd58fa180c0a8_479x115.png',
  'signature-principal.png': 'extracted_3_FormXob.e852da1dad474abc1fd35c568b70dcaf_297x108.png',
  'college-seal.png': 'extracted_4_FormXob.f71baeaee006a4b3e9ce1365effeb58b_800x800.png'
};

const srcDir = path.resolve('public/certificate-assets');
const destDirs = [
  path.resolve('public'),
  path.resolve('public/certificate-assets'),
  path.resolve('src/assets/certificate')
];

destDirs.forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

for (const [targetName, srcName] of Object.entries(map)) {
  const srcPath = path.join(srcDir, srcName);
  if (fs.existsSync(srcPath)) {
    const data = fs.readFileSync(srcPath);
    for (const d of destDirs) {
      fs.writeFileSync(path.join(d, targetName), data);
      console.log(`Copied ${targetName} to ${d} (${data.length} bytes)`);
    }
  } else {
    console.error(`Source missing: ${srcPath}`);
  }
}

// Also copy certificate-template.pdf to public/ and src/assets/
const templateSrc = 'C:\\Users\\Rutuja Kokane\\Downloads\\Technova_Code_Sprint_Certificate_Editable.pdf';
if (fs.existsSync(templateSrc)) {
  const pdfData = fs.readFileSync(templateSrc);
  fs.writeFileSync(path.resolve('public/certificate-template.pdf'), pdfData);
  fs.writeFileSync(path.resolve('src/assets/certificate/certificate-template.pdf'), pdfData);
  console.log('Saved certificate-template.pdf');
}
