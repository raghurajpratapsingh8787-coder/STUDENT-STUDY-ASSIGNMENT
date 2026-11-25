import PDFDocument from 'pdfkit';

export function buildNotesPdfBuffer(params: {
  title: string;
  subject: string;
  subtitle: string;
  content: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#0F172A').text(params.title);
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#475569')
      .text(`${params.subject}  ·  ${params.subtitle}  ·  Generated ${new Date().toLocaleDateString()}`);

    doc.moveDown(0.6);
    doc
      .moveTo(56, doc.y)
      .lineTo(539, doc.y)
      .lineWidth(0.75)
      .strokeColor('#CBD5E1')
      .stroke();
    doc.moveDown(0.8);

    const lines = params.content.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line.trim()) {
        doc.moveDown(0.45);
        continue;
      }

      if (line.startsWith('### ')) {
        doc.moveDown(0.4);
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#1E293B').text(line.slice(4));
        doc.moveDown(0.2);
      } else if (line.startsWith('## ')) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#0F172A').text(line.slice(3));
        doc.moveDown(0.25);
      } else if (line.startsWith('# ')) {
        doc.moveDown(0.6);
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#0F172A').text(line.slice(2));
        doc.moveDown(0.3);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        const clean = line.slice(2).replace(/\*\*/g, '');
        doc.font('Helvetica').fontSize(10.5).fillColor('#1E293B').text(`•  ${clean}`, {
          indent: 10,
          lineGap: 3,
        });
      } else {
        const clean = line.replace(/\*\*/g, '');
        doc.font('Helvetica').fontSize(10.5).fillColor('#1E293B').text(clean, {
          lineGap: 3,
        });
      }
    }

    doc.end();
  });
}
