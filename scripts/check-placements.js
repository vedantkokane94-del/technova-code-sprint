import fs from 'fs';
import zlib from 'zlib';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

function decodeAscii85(buffer) {
  let str = buffer.toString('binary');
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
        val = val * 85 + 84;
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
    if (filterObj.asArray) {
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
    }
  }
  return data;
}

async function checkPlacements() {
  const file = 'C:\\Users\\Rutuja Kokane\\Downloads\\Technova_Code_Sprint_Certificate_Editable.pdf';
  const bytes = fs.readFileSync(file);
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  
  const contentsRef = page.node.Contents();
  const streams = Array.isArray(contentsRef) ? contentsRef : (contentsRef.asArray ? contentsRef.asArray() : [contentsRef]);
  
  for (let i = 0; i < streams.length; i++) {
    const streamObj = pdfDoc.context.lookup(streams[i]);
    if (streamObj instanceof PDFRawStream) {
      const data = decodeStream(streamObj);
      const text = data.toString('utf-8');
      
      const lines = text.split('\n');
      lines.forEach((l, idx) => {
        if (l.includes('Do')) {
          console.log(`Stream ${i} line ${idx}: ${lines.slice(Math.max(0, idx-5), idx+2).join('  ///  ')}`);
        }
      });
    }
  }
}

checkPlacements().catch(console.error);
