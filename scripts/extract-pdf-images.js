import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { PNG } from 'pngjs';
import { PDFDocument, PDFName, PDFRawStream, PDFRef } from 'pdf-lib';

function decodeAscii85(buffer) {
  let str = buffer.toString('binary');
  // strip enclosing <~ and ~> if present
  str = str.replace(/^<~/, '').replace(/~>$/, '').replace(/\s+/g, '');
  const out = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === 'z') {
      out.push(0, 0, 0, 0);
      i++;
      continue;
    }
    let count = 0;
    let val = 0;
    for (let j = 0; j < 5; j++) {
      if (i < str.length) {
        val = val * 85 + (str.charCodeAt(i) - 33);
        count++;
        i++;
      } else {
        val = val * 85 + 84; // pad with 'u'
      }
    }
    const b0 = (val >>> 24) & 0xff;
    const b1 = (val >>> 16) & 0xff;
    const b2 = (val >>> 8) & 0xff;
    const b3 = val & 0xff;
    if (count >= 2) out.push(b0);
    if (count >= 3) out.push(b1);
    if (count >= 4) out.push(b2);
    if (count >= 5) out.push(b3);
  }
  return Buffer.from(out);
}

function decodeStream(streamObj) {
  let data = Buffer.from(streamObj.contents);
  const filterObj = streamObj.dict.lookup(PDFName.of('Filter'));
  let filters = [];
  if (filterObj) {
    if (Array.isArray(filterObj.asArray ? filterObj.asArray() : null)) {
      filters = filterObj.asArray().map(f => f.toString());
    } else {
      filters = [filterObj.toString()];
    }
  }

  for (const filter of filters) {
    if (filter === '/ASCII85Decode') {
      data = decodeAscii85(data);
    } else if (filter === '/FlateDecode') {
      data = zlib.inflateSync(data);
    } else {
      console.log('Unknown filter:', filter);
    }
  }
  return data;
}

async function run() {
  const file = 'C:\\Users\\Rutuja Kokane\\Downloads\\Technova_Code_Sprint_Certificate_Editable.pdf';
  const bytes = fs.readFileSync(file);
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  const resources = page.node.Resources();
  const xObjectDict = resources.lookup(PDFName.of('XObject'));
  
  const outDir = path.resolve('public/certificate-assets');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const entries = xObjectDict.entries();
  let index = 0;
  for (const [key, ref] of entries) {
    const obj = pdfDoc.context.lookup(ref);
    if (obj instanceof PDFRawStream) {
      const dict = obj.dict;
      const subtype = dict.lookup(PDFName.of('Subtype'))?.toString();
      if (subtype === '/Image') {
        index++;
        const width = dict.lookup(PDFName.of('Width')).asNumber();
        const height = dict.lookup(PDFName.of('Height')).asNumber();
        const colorSpace = dict.lookup(PDFName.of('ColorSpace'))?.toString();
        const sMaskRef = dict.lookup(PDFName.of('SMask'));

        console.log(`\nFound Image ${index} [${key.toString()}]: ${width}x${height}, CS=${colorSpace}, SMask=${!!sMaskRef}`);
        
        const rawPixels = decodeStream(obj);
        let maskPixels = null;
        if (sMaskRef) {
          const sMaskObj = pdfDoc.context.lookup(sMaskRef);
          if (sMaskObj instanceof PDFRawStream) {
            maskPixels = decodeStream(sMaskObj);
            console.log(`  Decoded SMask length: ${maskPixels.length} (expected ${width * height})`);
          }
        }

        console.log(`  Decoded image stream length: ${rawPixels.length} (expected ${width * height * 3})`);

        // Build PNG
        const png = new PNG({ width, height });
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x);
            const pngIdx = idx * 4;
            if (colorSpace === '/DeviceRGB') {
              png.data[pngIdx] = rawPixels[idx * 3];
              png.data[pngIdx + 1] = rawPixels[idx * 3 + 1];
              png.data[pngIdx + 2] = rawPixels[idx * 3 + 2];
            } else if (colorSpace === '/DeviceGray') {
              png.data[pngIdx] = rawPixels[idx];
              png.data[pngIdx + 1] = rawPixels[idx];
              png.data[pngIdx + 2] = rawPixels[idx];
            }
            png.data[pngIdx + 3] = maskPixels ? maskPixels[idx] : 255;
          }
        }

        const outPath = path.join(outDir, `extracted_${index}_${key.toString().replace('/', '')}_${width}x${height}.png`);
        const pngBuffer = PNG.sync.write(png);
        fs.writeFileSync(outPath, pngBuffer);
        console.log(`  Saved: ${outPath} (${pngBuffer.length} bytes)`);
      }
    }
  }
}

run().catch(console.error);
