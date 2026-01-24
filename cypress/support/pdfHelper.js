const PDFDocument = require('pdfkit');
const fs = require('fs');

async function generatePdf(testResults, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // --- CABEÇALHO ---
      doc.fontSize(16).text('Relatório de Execução de Testes', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Data: ${new Date().toLocaleString()}`, { align: 'right' });
      doc.moveDown(2);

      // --- LOOP PELOS TESTES ---
      testResults.forEach((test, index) => {
        // Nova página se estiver muito no final
        if (doc.y > 700) doc.addPage();

        // Título do Teste
        doc.fontSize(12).font('Helvetica-Bold')
           .text(`Teste ${index + 1}: ${test.title}`);
        
        // Status
        const statusColor = test.status === 'failed' ? '#FF0000' : '#008000';
        doc.fontSize(10).font('Helvetica')
           .fillColor(statusColor)
           .text(`Status Final: ${test.status.toUpperCase()}`);
        
        doc.fillColor('black').moveDown(0.5);

        // Steps e Evidências
        if (test.steps && test.steps.length > 0) {
          test.steps.forEach(step => {
            // Verifica quebra de página
            if (doc.y > 750) doc.addPage();

            // Texto do passo
            doc.text(`- ${step.step}`);

            // Se tiver screenshot
            if (step.screenshot && fs.existsSync(step.screenshot)) {
               // Verifica espaço para imagem
               if (doc.y > 600) doc.addPage();
               
               try {
                 doc.moveDown(0.5);
                 doc.image(step.screenshot, { 
                   fit: [400, 200], 
                   align: 'center' 
                 });
                 doc.moveDown(0.5);
               } catch (err) {
                 doc.text(`[Erro ao carregar imagem: ${err.message}]`, { color: 'red' });
               }
            }
            doc.moveDown(0.5);
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
