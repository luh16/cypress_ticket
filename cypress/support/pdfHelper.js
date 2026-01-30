// Biblioteca para criar o PDF
const PDFDocument = require('pdfkit');
// Acesso ao sistema de arquivos (ler .feature, verificar imagens etc.)
const fs = require('fs');
// Montar caminhos de forma segura (independente de SO)
const path = require('path');
const os = require('os'); // Importa módulo para pegar info do sistema

// Cache em memória dos cenários BDD já lidos das features
let featureScenariosCache = null;

// Lê todos os arquivos .feature e monta um mapa:
// "Título do Scenario" -> [linhas Given/When/Then/And/Dado/Quando/Então/E...]
function loadFeatureScenarios() {
  if (featureScenariosCache) return featureScenariosCache;

  const scenarios = {};
  const baseDirs = [
    path.join(process.cwd(), 'cypress', 'e2e'),
    path.join(process.cwd(), 'cypress', 'web', 'features')
  ];

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
        let backgroundSteps = []; 

        content.forEach(line => {
          const trimmed = line.trim();
          if (/^(Background|Contexto|Fundo):/i.test(trimmed)) {
            backgroundSteps = [];
            currentTitle = null; 
          } else if (/^(Scenario|Cenário|Cenario|Cénario):/i.test(trimmed)) {
            if (currentTitle) scenarios[currentTitle] = currentSteps;
            currentTitle = trimmed.replace(/^(Scenario|Cenário|Cenario|Cénario):/i, '').trim();
            currentSteps = [...backgroundSteps];
          } else if (/^(Given|When|Then|And|But|Dado|Quando|Então|Entao|E)\b/.test(trimmed)) {
            if (currentTitle) currentSteps.push(trimmed);
            else backgroundSteps.push(trimmed);
          }
        });
        if (currentTitle) scenarios[currentTitle] = currentSteps;
      }
    });
  }

  baseDirs.forEach(dir => walk(dir));
  featureScenariosCache = scenarios;
  return featureScenariosCache;
}

function sanitizeTitle(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function findGherkinStepsForTitle(testTitle) {
  const scenarios = loadFeatureScenarios();
  if (scenarios[testTitle]) return scenarios[testTitle];

  const normalized = testTitle.toLowerCase().trim();
  const sanitizedTest = sanitizeTitle(testTitle);
  for (const [scenarioTitle, steps] of Object.entries(scenarios)) {
    const normalizedScenario = scenarioTitle.toLowerCase().trim();
    const sanitizedScenario = sanitizeTitle(scenarioTitle);
    if (normalizedScenario.includes(normalized) || normalized.includes(normalizedScenario) ||
        sanitizedScenario === sanitizedTest || sanitizedScenario.includes(sanitizedTest) ||
        sanitizedTest.includes(sanitizedScenario)) {
      return steps;
    }
  }
  return null;
}

// Helper para desenhar cabeçalho
function drawHeader(doc) {
  doc.rect(0, 0, 600, 20).fill('#E4002B'); 
  doc.fillColor('black'); // Reseta a cor
}

// Helper para verificar e criar nova página
function checkPageBreak(doc, limit = 700) {
  if (doc.y > limit) {
    doc.addPage();
    drawHeader(doc);
    doc.moveDown(2);
    return true; // Indicador de que houve quebra
  }
  return false;
}

async function generatePdf(testResults, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // --- PÁGINA INICIAL ---
      drawHeader(doc);

      // Logo
      const logoPath = 'cypress/fixtures/logo-oficial.png';
      if (fs.existsSync(logoPath)) {
        try { doc.image(logoPath, 450, 40, { fit: [100, 50], align: 'right' }); } catch (e) { }
      }

      // Dados do Relatório
      doc.fillColor('black').fontSize(14).font('Helvetica-Bold').text('TICKET | EDENRED', 50, 50, { align: 'left' });
      doc.fontSize(12).font('Helvetica').text(`Host: ${os.hostname()}`, 50, 70, { align: 'left' });
      doc.fontSize(10).fillColor('#555555').text(`Data: ${new Date().toLocaleString()}`, 50, 90, { align: 'left' });

      doc.y = 130;
      doc.moveDown();

      // --- LOOP DOS TESTES ---
      testResults.forEach((test) => {
        checkPageBreak(doc);

        // Título e Status
        doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text(`${test.title}`);
        const statusColor = test.status === 'failed' ? '#E4002B' : '#28a745';
        doc.fontSize(10).font('Helvetica').fillColor(statusColor).text(`Status: ${test.status.toUpperCase()}`);
        doc.fillColor('black').moveDown(0.5);

        // Busca passos BDD
        const gherkinSteps = findGherkinStepsForTitle(test.title);
        let bddPrinted = true; // Flag: true = PRECISA IMPRIMIR, false = JÁ IMPRESSO

        // Função interna para imprimir BDD
        const printBDD = () => {
          if (gherkinSteps && gherkinSteps.length > 0) {
            try {
              doc.font('Helvetica').fontSize(9).fillColor('#333333');
              gherkinSteps.forEach(line => {
                if (checkPageBreak(doc)) doc.font('Helvetica').fontSize(9).fillColor('#333333');
                if (line) doc.text(line.toString(), { align: 'left' });
              });
              doc.moveDown(1);
            } catch (err) { console.error('[PDF DEBUG] Erro BDD:', err); }
          }
        };

        // Processa Evidências
        if (test.steps && test.steps.length > 0) {
          test.steps.forEach(step => {
            // Imprime BDD antes do primeiro screenshot
            if (bddPrinted) {
              printBDD();
              bddPrinted = false; 
            }

            if (step.screenshot && fs.existsSync(step.screenshot)) {
               checkPageBreak(doc, 600);
               
               try {
                 const stepName = (step.step && step.step !== 'Screenshot Capturado' && !step.step.startsWith('final_')) 
                                  ? step.step 
                                  : 'Screenshot';

                 if (stepName !== 'Screenshot') {
                    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text(stepName, { align: 'left' });
                 } else {
                    doc.font('Helvetica').fontSize(9).fillColor('#555555').text('Screenshot', { align: 'center' });
                 }
                 doc.moveDown(0.2);

                 let imagePath = path.isAbsolute(step.screenshot) ? step.screenshot : path.resolve(process.cwd(), step.screenshot);
                 if (fs.existsSync(imagePath)) {
                    doc.image(imagePath, { fit: [450, 250], align: 'center' });
                    doc.moveDown(1);
                 }
               } catch (err) {
                 doc.text(`[Erro imagem: ${err.message}]`, { color: 'red' });
               }
            }
          });
        }
        
        // Se não imprimiu BDD (sem screenshots), imprime agora
        if (bddPrinted) {
            printBDD();
        }
        
        // Separador
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke();
        doc.moveDown(1);
      });

      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', (err) => reject(err));
    } catch (err) { reject(err); }
  });
}

module.exports = { generatePdf };
