import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

async function run() {
  const file1 = 'C:\\Users\\Rutuja Kokane\\.gemini\\antigravity\\brain\\273fea38-ff06-4b96-a393-99a981bbbdd0\\.user_uploaded\\media_1791779981447_222d265b.pdf';
  const file2 = 'C:\\Users\\Rutuja Kokane\\Downloads\\Technova_Code_Sprint_Certificate_Editable.pdf';

  for (const f of [file1, file2]) {
    if (fs.existsSync(f)) {
      console.log(`\n--- Inspecting ${path.basename(f)} (${fs.statSync(f).size} bytes) ---`);
      const bytes = fs.readFileSync(f);
      const pdfDoc = await PDFDocument.load(bytes);
      console.log('Pages count:', pdfDoc.getPageCount());
      const page = pdfDoc.getPage(0);
      const { width, height } = page.getSize();
      console.log(`Dimensions: ${width} x ${height} pt`);
      console.log('Title:', pdfDoc.getTitle());
      console.log('Author:', pdfDoc.getAuthor());
    } else {
      console.log(`Not found: ${f}`);
    }
  }
}

run().catch(console.error);
