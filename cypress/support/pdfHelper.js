const PDFGenerator = require('pdfkit')
const fs = require('fs')
const path = require('path')

// --- PDF: COPIAR ARQUIVO INTEIRO ---
function generatePdf(options = {}) {
  const outFile = options.outputFile || 'TestDocument.pdf'
  const doc = new PDFGenerator({ size: 'A4', margin: 50 }) 
  doc.pipe(fs.createWriteStream(outFile))

  const companyName = options.companyName || 'TICKET | EDENRED'
  const date = options.date || new Date().toLocaleString()
  const environmentName = options.environmentName || 'QA'
  const qaName = options.qaName || 'QA Automation' 
  const device = options.device || 'Web'
  const logoPath = options.logoPath || path.resolve('cypress', 'images', 'logo.png')
  
  const steps = Array.isArray(options.steps) ? options.steps : []

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
  
  // --- STEPS ---
  let y = lineY + 30
  
  // Normaliza entrada: se tiver options.tests (lista de testes), usa.
  // Se tiver apenas options.steps (um único teste legado), converte para lista de 1 teste.
  let testsToPrint = [];
  if (options.tests && Array.isArray(options.tests)) {
    testsToPrint = options.tests;
  } else if (options.steps && Array.isArray(options.steps)) {
    testsToPrint = [{ title: 'Execução do Teste', steps: options.steps }];
  }

  if (testsToPrint.length > 0) {
    testsToPrint.forEach((testItem, tIndex) => {
        // Quebra de página se não couber o título
        if (y > 700) {
            doc.addPage({ size: 'A4', margin: 50 })
            y = 50
        }

        // Título do Teste (se houver mais de um ou se tiver título definido)
        if (testItem.title) {
            doc.font('Helvetica-Bold').fontSize(14).fillColor('#0056b3')
               .text(`Caso de Teste ${tIndex + 1}: ${testItem.title}`, pageMargin, y, { width: pageWidth - (pageMargin * 2) })
            y += 25
            
            // Linha separadora fina abaixo do título
            doc.strokeColor('#eee').lineWidth(1)
               .moveTo(pageMargin, y).lineTo(pageWidth - pageMargin, y).stroke()
            y += 15
        }

        const steps = testItem.steps || [];
        steps.forEach((step, index) => {
            if (y > 750) {
                doc.addPage({ size: 'A4', margin: 50 })
                y = 50
            }

            doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
               .text(`${index + 1}. ${step.step}`, pageMargin, y, { width: pageWidth - (pageMargin * 2) })
            
            y += 40 
            
            // Status
            const isFailure = String(step.status).toLowerCase().includes('fail');
            const statusText = isFailure ? 'FAILED' : 'PASSED';
            
            doc.font('Helvetica-Bold').fontSize(12).fillColor(isFailure ? '#d32f2f' : '#2e7d32')
               .text(`Status: ${statusText}`, pageMargin, y)
            
            y += 30 
            
            if (step.screenshot && fs.existsSync(step.screenshot)) {
                try {
                // Verifica espaço para imagem
                if (y + 300 > 800) {
                    doc.addPage({ size: 'A4', margin: 50 })
                    y = 50
                }
                doc.image(step.screenshot, pageMargin, y, { width: 480 })
                y += 300
                } catch(e) { }
            }
            y += 30
        })

        // Espaço entre testes
        y += 20;
        doc.strokeColor('#000').lineWidth(2)
           .moveTo(pageMargin, y).lineTo(pageWidth - pageMargin, y).stroke()
        y += 40;
    })
  }

  doc.end()
  
  // Limpeza de logs
  const logsDir = path.resolve('cypress/results/logs');
  try {
    if (fs.existsSync(logsDir)) {
      setTimeout(() => {
        try {
          fs.rmSync(logsDir, { recursive: true, force: true });
        } catch (e) { }
      }, 1000);
    }
  } catch (e) { }
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
