import fs from 'fs';
import path from 'path';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

async function extract() {
  const file = 'C:\\Users\\Rutuja Kokane\\Downloads\\Technova_Code_Sprint_Certificate_Editable.pdf';
  const bytes = fs.readFileSync(file);
  const pdfDoc = await PDFDocument.load(bytes);
  
  const outDir = path.resolve('public/certificate-assets');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const context = pdfDoc.context;
  const indirectObjects = context.enumerateIndirectObjects();
  
  let imgCount = 0;
  for (const [ref, obj] of indirectObjects) {
    if (obj instanceof PDFRawStream) {
      const dict = obj.dict;
      const subtype = dict.lookup(PDFName.of('Subtype'));
      if (subtype && subtype.toString() === '/Image') {
        imgCount++;
        const width = dict.lookup(PDFName.of('Width'))?.value || dict.lookup(PDFName.of('Width'))?.numberValue;
        const height = dict.lookup(PDFName.of('Height'))?.value || dict.lookup(PDFName.of('Height'))?.numberValue;
        const filter = dict.lookup(PDFName.of('Filter'))?.toString();
        const colorSpace = dict.lookup(PDFName.of('ColorSpace'))?.toString();
        const sMask = dict.lookup(PDFName.of('SMask'));
        
        console.log(`Image ${imgCount}: Ref=${ref.toString()} Width=${width} Height=${height} Filter=${filter} ColorSpace=${colorSpace} SMask=${sMask ? 'yes' : 'no'} StreamLength=${obj.contents.length}`);

        // Save raw stream
        const ext = filter === '/DCTDecode' ? 'jpg' : 'bin';
        fs.writeFileSync(path.join(outDir, `img_${imgCount}_ref${ref.tag}_${width}x${height}.${ext}`), obj.contents);
      }
    }
  }
  console.log(`Extracted/analyzed ${imgCount} images.`);
}

extract().catch(console.error);
