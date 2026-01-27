const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

let featureScenariosCache = null;

function loadFeatureScenarios() {
  if (featureScenariosCache) return featureScenariosCache;

  const scenarios = {};
  const baseDir = path.join(process.cwd(), 'cypress', 'e2e');

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.feature')) {
        const content = fs.readFileSync(fullPath, 'utf-8').split(/\r?\n/);

        let currentTitle = null;
        let currentSteps = [];

        content.forEach(line => {
          const trimmed = line.trim();

          if (trimmed.startsWith('Scenario:')) {
            if (currentTitle) {
              scenarios[currentTitle] = currentSteps;
            }
            currentTitle = trimmed.replace('Scenario:', '').trim();
            currentSteps = [];
          } else if (/^(Given|When|Then|And|But|Dado|Quando|Então|Entao|E)\b/.test(trimmed)) {
            currentSteps.push(trimmed);
          }
        });

        if (currentTitle) {
          scenarios[currentTitle] = currentSteps;
        }
      }
    });
  }

  walk(baseDir);
  featureScenariosCache = scenarios;
  return featureScenariosCache;
}

function findGherkinStepsForTitle(testTitle) {
  const scenarios = loadFeatureScenarios();

  if (scenarios[testTitle]) return scenarios[testTitle];

  const normalized = testTitle.toLowerCase();
  for (const [scenarioTitle, steps] of Object.entries(scenarios)) {
    const normalizedScenario = scenarioTitle.toLowerCase();
    if (normalizedScenario.includes(normalized) || normalized.includes(normalizedScenario)) {
      return steps;
    }
  }

  return null;
}

async function generatePdf(testResults, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // --- FAIXA VERMELHA NO TOPO (Ticket Edenred) ---
      doc.rect(0, 0, 600, 20).fill('#E4002B'); 

      const logoPath = 'cypress/fixtures/logo.png';
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 450, 40, { fit: [100, 50], align: 'right' });
        } catch (e) { }
      }

      // --- CABEÇALHO (Esquerda) ---
      doc.fillColor('black').fontSize(14).font('Helvetica-Bold')
         .text('Nome da Empresa', 50, 50, { align: 'left' });
      
      doc.fontSize(12).font('Helvetica')
         .text('QA Automação', 50, 70, { align: 'left' });
      
      doc.fontSize(10).fillColor('#555555')
         .text(`Data: ${new Date().toLocaleString()}`, 50, 90, { align: 'left' });

      doc.y = 130; // Garante espaço após cabeçalho
      doc.moveDown();

      // --- LOOP DOS TESTES ---
      testResults.forEach((test, index) => {
        // Quebra de página se necessário
        if (doc.y > 700) {
          doc.addPage();
          doc.rect(0, 0, 600, 20).fill('#E4002B'); // Repete a faixa na nova página
          doc.fillColor('black'); // Reseta a cor
          doc.moveDown(2);
        }

        doc.fontSize(12).font('Helvetica-Bold').fillColor('black')
           .text(`CT: ${test.title}`);
        
        const statusColor = test.status === 'failed' ? '#E4002B' : '#28a745'; // Vermelho Ticket ou Verde
        doc.fontSize(10).font('Helvetica').fillColor(statusColor)
           .text(`Status: ${test.status.toUpperCase()}`);
        
        doc.fillColor('black').moveDown(0.5);

        const gherkinSteps = findGherkinStepsForTitle(test.title);
        if (gherkinSteps && gherkinSteps.length > 0) {
          doc.fontSize(9).font('Helvetica').fillColor('#333333');
          doc.text('Passos Executados:', { underline: true });
          doc.moveDown(0.2);

          gherkinSteps.forEach(line => {
            doc.text(`• ${line}`);
          });

          doc.moveDown(1);
        } else if (test.steps && test.steps.length > 0) {
          doc.fontSize(9).font('Helvetica').fillColor('#333333');

          const textSteps = test.steps.filter(s => !s.screenshot);

          if (textSteps.length > 0) {
            doc.text('Passos Executados:', { underline: true });
            doc.moveDown(0.2);

            textSteps.forEach(step => {
              const stepText = (step.step || '').replace(/[\r\n]+/g, ' ').substring(0, 100);
              if (stepText) doc.text(`• ${stepText}`);
            });

            doc.moveDown(1);
          }
        }

        // Evidências (Screenshots)
        if (test.steps && test.steps.length > 0) {
          test.steps.forEach(step => {
            if (step.screenshot && fs.existsSync(step.screenshot)) {
               // Verifica espaço
               if (doc.y > 600) {
                 doc.addPage();
                 doc.rect(0, 0, 600, 20).fill('#E4002B');
                 doc.fillColor('black');
                 doc.moveDown(2);
               }
               
               try {
                 // Legenda simples
                 doc.font('Helvetica').fontSize(9).fillColor('#555555')
                    .text(`${test.title} - ${test.status.toUpperCase()}`, { align: 'center' });
                 
                 doc.moveDown(0.2);
                 
                 // Imagem
                 doc.image(step.screenshot, { 
                   fit: [450, 250], 
                   align: 'center' 
                 });
                 doc.moveDown(1);
               } catch (err) {
                 doc.text('[Erro imagem]', { color: 'red' });
               }
            }
          });
        }
        
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke(); // Linha separadora
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
