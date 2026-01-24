const PDFGenerator = require('pdfkit')
const fs = require('fs')
const path = require('path')

// --- PDF: COPIAR ARQUIVO INTEIRO ---
function generatePdf(options = {}) {
  return new Promise((resolve, reject) => {
    try {
        const outFile = options.outputFile || 'TestDocument.pdf'
        const doc = new PDFGenerator({ size: 'A4', margin: 50 }) 
        const stream = fs.createWriteStream(outFile);
        doc.pipe(stream);

        const companyName = options.companyName || 'TICKET | EDENRED'
        const date = options.date || new Date().toLocaleString()
        const environmentName = options.environmentName || 'QA'
        const qaName = options.qaName || 'QA Automation' 
        const device = options.device || 'Web'
        const logoPath = options.logoPath || path.resolve('cypress', 'images', 'logo.png')
        
        // --- CABEÇALHO ---
        const pageWidth = doc.page.width;
        const pageMargin = 50;
        
        // Logo
        if (logoPath && fs.existsSync(logoPath)) {
            try {
            doc.image(logoPath, pageMargin, 40, { width: 100 })
            } catch(e) { }
        }

        // Informações
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#000')
            .text(companyName, 0, 40, { align: 'right', width: pageWidth - pageMargin })
        
        doc.font('Helvetica').fontSize(10).fillColor('#000')
        doc.moveDown(0.5)

        const metaY = doc.y;
        doc.text(`Data: ${date}`, 0, metaY, { align: 'right', width: pageWidth - pageMargin })
        doc.text(`Dispositivo: ${device}`, 0, metaY + 15, { align: 'right', width: pageWidth - pageMargin })
        doc.text(`Ambiente: ${environmentName}`, 0, metaY + 30, { align: 'right', width: pageWidth - pageMargin })
        doc.text(`QA Responsável: ${qaName}`, 0, metaY + 45, { align: 'right', width: pageWidth - pageMargin })

        doc.moveDown(2)
        const lineY = metaY + 75; 
        doc.strokeColor('#ccc').lineWidth(1)
            .moveTo(pageMargin, lineY)
            .lineTo(pageWidth - pageMargin, lineY)
            .stroke()
        
        // --- STEPS (Suporte a múltiplos testes) ---
        let y = lineY + 30
        
        // Normaliza entrada
        let testsToPrint = [];
        if (options.tests && Array.isArray(options.tests)) {
            testsToPrint = options.tests;
        } else if (options.steps && Array.isArray(options.steps)) {
            testsToPrint = [{ title: 'Execução do Teste', steps: options.steps }];
        }

        if (testsToPrint.length > 0) {
            testsToPrint.forEach((testItem, tIndex) => {
                // Verifica se cabe o título (precisa de uns 60pts)
                if (y > 750) {
                    doc.addPage({ size: 'A4', margin: 50 })
                    y = 50
                }

                // Título do Teste
                if (testItem.title) {
                    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0056b3')
                    .text(`Caso de Teste ${tIndex + 1}: ${testItem.title}`, pageMargin, y, { width: pageWidth - (pageMargin * 2) })
                    
                    // Atualiza y baseado na altura do texto escrito (pode quebrar linha)
                    y = doc.y + 5;
                    
                    // Linha separadora
                    doc.strokeColor('#eee').lineWidth(1)
                    .moveTo(pageMargin, y).lineTo(pageWidth - pageMargin, y).stroke()
                    y += 15
                }

                const steps = testItem.steps || [];
                steps.forEach((step, index) => {
                    // Verifica espaço para o texto do passo
                    if (y > 780) {
                        doc.addPage({ size: 'A4', margin: 50 })
                        y = 50
                    }

                    // Passo
                    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
                    .text(`${index + 1}. ${step.step}`, pageMargin, y, { width: pageWidth - (pageMargin * 2) })
                    
                    y = doc.y + 10; // Pega o Y real após o texto
                    
                    // Status
                    const isFailure = String(step.status).toLowerCase().includes('fail');
                    const statusText = isFailure ? 'FAILED' : 'PASSED';
                    
                    doc.font('Helvetica-Bold').fontSize(12).fillColor(isFailure ? '#d32f2f' : '#2e7d32')
                    .text(`Status: ${statusText}`, pageMargin, y)
                    
                    y = doc.y + 10;

                    // Screenshot
                    if (step.screenshot && fs.existsSync(step.screenshot)) {
                        try {
                            // Espaço disponível na página
                            const spaceLeft = 800 - y;
                            const imgHeight = 250; // Altura fixa estimada para a imagem redimensionada

                            if (spaceLeft < imgHeight) {
                                doc.addPage({ size: 'A4', margin: 50 })
                                y = 50
                            }

                            // Desenha imagem centralizada ou ajustada
                            // fit: [largura, altura] garante que não distorça
                            doc.image(step.screenshot, pageMargin, y, { fit: [480, 250], align: 'center' })
                            
                            // Incrementa Y baseado na altura reservada (ou poderíamos tentar medir)
                            y += 260 
                        } catch(e) { 
                            console.error('Erro ao inserir imagem:', e);
                        }
                    }
                    y += 20 // Espaço entre passos
                })

                // Espaço entre testes
                y += 20;
                doc.strokeColor('#000').lineWidth(2)
                .moveTo(pageMargin, y).lineTo(pageWidth - pageMargin, y).stroke()
                y += 40;
            })
        }

        doc.end()
        
        stream.on('finish', () => {
            resolve(outFile);
        });
        
        stream.on('error', (err) => {
            reject(err);
        });

    } catch (err) {
        reject(err);
    }
  });
}

function generateFromScreenshots(options = {}) {
  const screenshotsDir = path.resolve('cypress/screenshots');
  if (!fs.existsSync(screenshotsDir)) return;

  const steps = [];
  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        scanDir(fullPath);
      } else if (file.endsWith('.png')) {
        steps.push({
          step: path.basename(file, '.png'),
          status: 'screenshot',
          screenshot: fullPath
        });
      }
    });
  }
  scanDir(screenshotsDir);

  if (steps.length === 0) return;

  const pdfOptions = {
    ...options,
    steps: steps,
    outputFile: options.outputFile || 'cypress/evidence/Evidence_Manual.pdf'
  };

  const outDir = path.dirname(pdfOptions.outputFile);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  generatePdf(pdfOptions);
  console.log('PDF gerado:', pdfOptions.outputFile);
}

module.exports = { generatePdf, generateFromScreenshots }
