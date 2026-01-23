const PDFGenerator = require('pdfkit')
const fs = require('fs')
const path = require('path')
const os = require('os')


function generatePdf(options = {}) {
  const outFile = options.outputFile || 'TestDocument.pdf'
  // Alterado para A4 para ficar mais padrão e fácil de ler, ou mantemos A2 se preferir telas grandes
  // Vou manter A4 por enquanto para testar o layout mais "bonito"
  const doc = new PDFGenerator({ size: 'A4', margin: 50 }) 
  doc.pipe(fs.createWriteStream(outFile))

 
  // Removido US/TestKey conforme solicitado
  const companyName = options.companyName || 'TICKET | EDENRED'
  const nameCt = options.nameCt || 'Evidência de Testes'
  const status = options.status || ''
  const date = options.date || new Date().toLocaleString()
  const environmentName = options.environmentName || 'QA'
  const qaName = options.qaName || 'QA'
  const device = options.device || 'Web'
  const logoPath = options.logoPath || path.resolve('cypress', 'images', 'logo.png')
  
  const files = Array.isArray(options.files) ? options.files : []
  const steps = Array.isArray(options.steps) ? options.steps : []

  // --- CABEÇALHO ---
  const pageWidth = doc.page.width;
  const pageMargin = 50;
  
  // 1. Logo à esquerda
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, pageMargin, 40, { width: 100 })
    } catch(e) { }
  }

  // 2. Informações à direita (Alinhado à direita)
  const headerX = pageWidth / 2; // Começa do meio para a direita
  const headerWidth = (pageWidth / 2) - pageMargin;
  
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#000')
     .text(companyName, 0, 40, { align: 'right', width: pageWidth - pageMargin })
  
  doc.font('Helvetica').fontSize(10).fillColor('#000')
  doc.moveDown(0.5)

  // Lista de Metadados
  const metaY = doc.y;
  // doc.text(`US: ${testKey}`, 0, metaY, { align: 'right', width: pageWidth - pageMargin }) // Removido
  doc.text(`Data: ${date}`, 0, metaY, { align: 'right', width: pageWidth - pageMargin })
  doc.text(`Dispositivo: ${device}`, 0, metaY + 15, { align: 'right', width: pageWidth - pageMargin })
  doc.text(`Ambiente: ${environmentName}`, 0, metaY + 30, { align: 'right', width: pageWidth - pageMargin })
  doc.text(`QA Responsável: ${qaName}`, 0, metaY + 45, { align: 'right', width: pageWidth - pageMargin })

  // Linha divisória
  doc.moveDown(2)
  const lineY = metaY + 75; // Ajustado altura pois removemos uma linha
  doc.strokeColor('#ccc').lineWidth(1)
     .moveTo(pageMargin, lineY)
     .lineTo(pageWidth - pageMargin, lineY)
     .stroke()
  
  // --- CONTEÚDO (STEPS) ---
  let y = lineY + 30
  
  if (steps.length > 0) {
    steps.forEach((step, index) => {
      // Verifica quebra de página
      if (y > 750) {
        doc.addPage({ size: 'A4', margin: 50 })
        y = 50
      }

      // Título do Step (Sempre preto, mesmo se falhar)
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
         .text(`${index + 1}. ${step.step}`, pageMargin, y, { width: pageWidth - (pageMargin * 2) })
      
      y += 20
      
      // Status (destaque apenas no texto do status)
      const isFailure = String(step.status).toLowerCase().includes('fail');
      doc.font('Helvetica').fontSize(10).fillColor(isFailure ? '#d32f2f' : '#666')
         .text(`Status: ${step.status.toUpperCase()}`, pageMargin, y)
      
      y += 20
      
      // Imagem do Step
      if (step.screenshot && fs.existsSync(step.screenshot)) {
         try {
           // Calcula tamanho proporcional para caber na A4 (max width ~500)
           const imgWidth = 480; 
           doc.image(step.screenshot, pageMargin, y, { width: imgWidth })
           
           // Pega a altura da imagem inserida para ajustar o Y
           // Como o pdfkit não retorna fácil, estimamos pela proporção (screenshots costumam ser 16:9 ou similares)
           // Vamos assumir uma altura fixa proporcional ou ajustar manualmente
           y += 300 // Espaço reservado para a imagem (ajuste conforme necessário)
         } catch(e) {
           doc.text(`(Erro ao carregar imagem)`, pageMargin, y)
           y += 20
         }
      } else {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor('#999')
           .text('(Sem evidência visual)', pageMargin, y)
        y += 20
      }
      
      y += 30 // Espaço entre steps
    })

  } else {
     // Fallback para imagens soltas (Layout melhorado também)
     let y = 150
     files.forEach((file, index) => {
        if (y > 700) {
           doc.addPage({ size: 'A4', margin: 50 })
           y = 50
        }
        const fileLabel = path.basename(file).replace('.png', '')
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#333')
           .text(`${index + 1}. ${fileLabel}`, pageMargin, y)
        y += 20
        doc.image(file, pageMargin, y, { width: 480 })
        y += 320
     })
  }

  // Rodapé
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor('#aaa')
       .text(`Gerado automaticamente por Cypress Helper - Página ${i + 1}`, 
             pageMargin, 
             doc.page.height - 30, 
             { align: 'center', width: pageWidth - (pageMargin * 2) });
  }

  doc.end()
}

function collectScreenshots(dir) {
  const list = []
  if (!fs.existsSync(dir)) return list
  const walk = d => {
    const entries = fs.readdirSync(d, { withFileTypes: true })
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (p.toLowerCase().endsWith('.png')) list.push(p)
    }
  }
  walk(dir)
  return list
}

function collectLogs(dir) {
  const allSteps = [];
  if (!fs.existsSync(dir)) return allSteps;
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  files.forEach(f => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (Array.isArray(content)) {
        allSteps.push(...content);
      }
    } catch (e) {
      console.error('Erro ao ler log:', f);
    }
  });
  return allSteps;
}

function generateFromScreenshots(options = {}) {
  const screenshotsDir = options.screenshotsDir || path.resolve('cypress', 'screenshots')
  const logsDir = path.resolve('cypress', 'results', 'logs')
  
  // Tenta buscar logs estruturados primeiro
  const steps = collectLogs(logsDir);
  
  // Se não tiver logs, cai no fallback de pegar todas as imagens
  const files = steps.length === 0 ? collectScreenshots(screenshotsDir) : [];

  // Caminho do logo
  const logoCandidate = path.resolve('cypress', 'images', 'logo.png')
  
  generatePdf({
    outputFile: options.outputFile || path.resolve('cypress', 'results', 'ExecutionEvidence.pdf'),
    testKey: options.testKey || '',
    nameCt: options.nameCt || 'Evidência Consolidada',
    status: options.status || '',
    date: options.date || new Date().toLocaleString(),
    environmentName: options.environmentName || 'QA Environment',
    logoPath: fs.existsSync(logoCandidate) ? logoCandidate : null,
    files,
    steps
  })

  // Limpa a pasta de logs após gerar o PDF
  try {
    if (fs.existsSync(logsDir)) {
      fs.rmSync(logsDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('Não foi possível remover a pasta de logs:', e.message);
  }
}

module.exports = { generatePdf, generateFromScreenshots }