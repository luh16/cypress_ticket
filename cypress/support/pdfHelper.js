// Biblioteca para criar o PDF
const PDFDocument = require('pdfkit');
// Acesso ao sistema de arquivos (ler .feature, verificar imagens etc.)
const fs = require('fs');
// Montar caminhos de forma segura (independente de SO)
const path = require('path');

// Gera o PDF consolidado de execução a partir da lista de testes (testResults)
// Cada item de testResults deve conter:
// - title: nome do teste/cenário
// - status: passed | failed
// - steps: array com objetos que possuem, entre outras coisas, "screenshot"
async function generatePdf(testResults, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Cria documento A4 com margens padrão
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // --- FAIXA VERMELHA NO TOPO (Ticket Edenred) ---
      doc.rect(0, 0, 600, 20).fill('#E4002B'); 

      // --- LOGO (Canto Direito) ---
      const logoPath = 'cypress/fixtures/logo-oficial.png';
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 450, 40, { fit: [100, 50], align: 'right' });
        } catch (e) { }
      }

      // --- CABEÇALHO (Esquerda) ---
      doc.fillColor('black').fontSize(14).font('Helvetica-Bold')
         .text('TICKET | EDENRED', 50, 50, { align: 'left' });
      
      doc.fontSize(12).font('Helvetica')
         .text('QA Automação', 50, 70, { align: 'left' });
      
      doc.fontSize(10).fillColor('#555555')
         .text(`Data: ${new Date().toLocaleString()}`, 50, 90, { align: 'left' });

      // Define posição inicial de escrita após o cabeçalho
      doc.y = 130;
      doc.moveDown();

      // --- LOOP DOS TESTES ---
      // Para cada teste executado, escreve título, status e evidências
      testResults.forEach((test, index) => {
        // Quebra de página se necessário
        if (doc.y > 700) {
          doc.addPage();
          doc.rect(0, 0, 600, 20).fill('#E4002B'); // Repete a faixa na nova página
          doc.fillColor('black'); // Reseta a cor
          doc.moveDown(2);
        }

        // Título do cenário / teste
        doc.fontSize(12).font('Helvetica-Bold').fillColor('black')
           .text(`${test.title}`);
        
        // Cor do status: vermelho para falha, verde para sucesso
        const statusColor = test.status === 'failed' ? '#E4002B' : '#28a745';
        doc.fontSize(10).font('Helvetica').fillColor(statusColor)
           .text(`Status: ${test.status.toUpperCase()}`);
        
        doc.fillColor('black').moveDown(0.5);

        // --- LISTA DE PASSOS (RESUMO) ---
        // Exibe os passos executados antes das evidências visuais
        if (test.steps && test.steps.length > 0) {
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333').text('Passos Executados:', { underline: true });
            doc.moveDown(0.2);
            doc.font('Helvetica').fontSize(9).fillColor('#333333');

            test.steps.forEach(step => {
                // Filtra passos internos/automáticos para mostrar apenas o fluxo relevante
                const isRelevantStep = step.step && 
                                     !step.step.startsWith('final_') && 
                                     step.step !== 'Screenshot Capturado';
                
                if (isRelevantStep) {
                    // Verifica quebra de página para a lista
                    if (doc.y > 720) {
                        doc.addPage();
                        doc.rect(0, 0, 600, 20).fill('#E4002B');
                        doc.fillColor('black');
                        doc.moveDown(2);
                        doc.font('Helvetica').fontSize(9).fillColor('#333333');
                    }
                    doc.text(`• ${step.step}`, { align: 'left', indent: 10 });
                }
            });
            doc.moveDown(1);
        }

        // --- EVIDÊNCIAS (SCREENSHOTS) ---
        if (test.steps && test.steps.length > 0) {
          test.steps.forEach(step => {
            // Só exibe se tiver screenshot válido
            if (step.screenshot && fs.existsSync(step.screenshot)) {
               // Verifica espaço na página atual antes de inserir novo bloco
               if (doc.y > 600) {
                 doc.addPage();
                 doc.rect(0, 0, 600, 20).fill('#E4002B');
                 doc.fillColor('black');
                 doc.moveDown(2);
               }
               
               try {
                 // Exibe nome do passo acima da imagem
                 const stepName = (step.step && !step.step.startsWith('final_')) ? step.step : 'Evidência Final / Erro';
                 
                 doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
                    .text(stepName, { align: 'left' });
                 
                 doc.moveDown(0.2);

                 // Tenta resolver caminho absoluto se for relativo
                 let imagePath = step.screenshot;
                 if (!path.isAbsolute(imagePath)) {
                    imagePath = path.resolve(process.cwd(), imagePath);
                 }

                 // Imagem da evidência
                 doc.image(imagePath, { 
                   fit: [450, 250], 
                   align: 'center' 
                 });
                 doc.moveDown(1);
               } catch (err) {
                 console.error(`[PDF DEBUG] Erro ao renderizar imagem: ${step.screenshot}`, err);
                 doc.text(`[Erro imagem: ${err.message}]`, { color: 'red' });
               }
            }
          });
        }
        
        // Linha separadora entre testes
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
