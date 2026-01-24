const PDFDocument = require('pdfkit');
const fs = require('fs');

async function generatePdf(testResults, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // --- CABEÇALHO ---
      doc.fontSize(14).text('Nome da Empresa', { align: 'left' });
      doc.fontSize(12).text('QA Automação', { align: 'left' });
      doc.fontSize(10).text(`Data: ${new Date().toLocaleString()}`, { align: 'left' });
      doc.moveDown(2);

      // --- LOOP PELOS TESTES ---
      testResults.forEach((test, index) => {
        // Nova página se estiver muito no final
        if (doc.y > 700) doc.addPage();

        // Título do Teste
        doc.fontSize(12).font('Helvetica-Bold')
           .text(`CT: ${test.title}`);
        
        // Status
        const statusColor = test.status === 'failed' ? '#FF0000' : '#008000';
        doc.fontSize(10).font('Helvetica')
           .fillColor(statusColor)
           .text(`Status: ${test.status.toUpperCase()}`);
        
        doc.fillColor('black').moveDown(0.5);

        // Steps e Evidências
        if (test.steps && test.steps.length > 0) {
          test.steps.forEach(step => {
            // Filtra para mostrar APENAS screenshots, ignorando erros de texto e logs
            if (step.screenshot && fs.existsSync(step.screenshot)) {
               // Verifica quebra de página
               if (doc.y > 600) doc.addPage();
               
               try {
                 // Texto sobre o screenshot (substituindo "Screenshot Capturado")
                 doc.font('Helvetica').fontSize(9).text(`${test.title} - Status: ${test.status.toUpperCase()}`, { align: 'center' });

                 doc.moveDown(0.2);
                 doc.image(step.screenshot, { 
                   fit: [450, 250], 
                   align: 'center' 
                 });
                 doc.moveDown(1);
               } catch (err) {
                 doc.text(`[Erro ao carregar imagem]`, { color: 'red' });
               }
            }
          });
        }
        
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke();
        doc.moveDown(1);
      });

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', (err) => reject(err));

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generatePdf };
