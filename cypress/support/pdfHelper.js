const PDFDocument = require('pdfkit');
const fs = require('fs');

async function generatePdf(testResults, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Cores da Ticket / Edenred
      const COLOR_PRIMARY = '#E4002B'; // Vermelho Ticket
      const COLOR_SECONDARY = '#333333'; // Cinza Escuro
      const COLOR_TEXT = '#555555'; // Cinza Texto
      const COLOR_PASSED = '#28a745'; // Verde Sucesso
      const COLOR_FAILED = '#dc3545'; // Vermelho Falha

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // --- BARRA SUPERIOR DECORATIVA ---
      doc.rect(0, 0, 600, 20).fill(COLOR_PRIMARY);

      // --- CABEÇALHO ---
      // Logo (Lado Direito Superior)
      const logoPath = 'cypress/fixtures/logo.png'; 
      if (fs.existsSync(logoPath)) {
          try {
              doc.image(logoPath, 450, 40, { fit: [100, 50], align: 'right' });
          } catch (e) {
              console.log('Erro ao carregar logo:', e.message);
          }
      }

      // Título e Informações (Lado Esquerdo)
      doc.fillColor(COLOR_PRIMARY).fontSize(20).font('Helvetica-Bold')
         .text('Relatório de Testes Automatizados', 50, 50, { align: 'left' });
      
      doc.moveDown(0.5);
      doc.fillColor(COLOR_SECONDARY).fontSize(10).font('Helvetica')
         .text('Projeto: QA Automação | Ticket Edenred', { align: 'left' });
      
      doc.text(`Data da Execução: ${new Date().toLocaleString()}`, { align: 'left' });
      
      doc.moveDown(2);
      
      // Linha divisória elegante
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#dddddd').lineWidth(1).stroke();
      doc.moveDown(2);

      // --- LOOP PELOS TESTES ---
      testResults.forEach((test, index) => {
        // Nova página se estiver muito no final
        if (doc.y > 700) doc.addPage();

        // Caixa de Fundo do Título do Teste
        const startY = doc.y;
        doc.rect(50, startY - 5, 500, 25).fillAndStroke('#f8f9fa', '#eeeeee');
        
        // Título do Teste
        doc.fillColor(COLOR_SECONDARY).fontSize(12).font('Helvetica-Bold')
           .text(`CT ${index + 1}: ${test.title}`, 60, startY + 2);

        // Badge de Status (Lado Direito do Título)
        const statusText = test.status.toUpperCase();
        const statusColor = test.status === 'failed' ? COLOR_FAILED : COLOR_PASSED;
        
        doc.fontSize(10).font('Helvetica-Bold').fillColor(statusColor)
           .text(statusText, 480, startY + 2, { align: 'right', width: 60 });
        
        doc.moveDown(2);

        // Steps e Evidências
        if (test.steps && test.steps.length > 0) {
          test.steps.forEach(step => {
            // Filtra para mostrar APENAS screenshots
            if (step.screenshot && fs.existsSync(step.screenshot)) {
               // Verifica quebra de página
               if (doc.y > 600) doc.addPage();
               
               try {
                 // Moldura da Imagem
                 doc.rect(70, doc.y, 455, 255).strokeColor('#dddddd').lineWidth(1).stroke();
                 
                 // Imagem
                 doc.image(step.screenshot, 72, doc.y + 2, { 
                   fit: [450, 250], 
                   align: 'center' 
                 });

                 // Legenda da Imagem
                 doc.y += 260;
                 doc.fillColor(COLOR_TEXT).fontSize(8).font('Helvetica')
                    .text(`Evidência: ${test.title} | Status: ${statusText}`, { align: 'center' });
                 
                 doc.moveDown(1.5);

               } catch (err) {
                 doc.fillColor('red').text(`[Erro ao carregar imagem]`, { align: 'center' });
               }
            }
          });
        }
        
        doc.moveDown(1);
      });

      // --- RODAPÉ ---
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#aaaaaa')
           .text(`Ticket Edenred - Confidencial | Página ${i + 1} de ${range.count}`, 
                 50, 
                 doc.page.height - 50, 
                 { align: 'center' }
           );
      }

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', (err) => reject(err));

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generatePdf };