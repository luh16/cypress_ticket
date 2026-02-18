// Biblioteca para criar o PDF
const PDFDocument = require('pdfkit');
// Acesso ao sistema de arquivos (ler .feature, verificar imagens etc.)
const fs = require('fs');
// Montar caminhos de forma segura (independente de SO)
const path = require('path');

// Cache em memória dos cenários BDD já lidos das features
let featureScenariosCache = null;

function loadFeatureScenarios() {
  if (featureScenariosCache) return featureScenariosCache;

  const scenarios = {};
  const featureByScenario = {};
  // Suporta duas estruturas de projeto:
  // - cypress/e2e
  // - cypress/web/features
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

        let currentFeature = null;
        let currentTitle = null;
        let currentSteps = [];
        let backgroundSteps = []; // Armazena passos do Contexto/Background

        content.forEach(line => {
          const trimmed = line.trim();
          if (/^(Feature|Funcionalidade):/i.test(trimmed)) {
            currentFeature = trimmed.replace(/^(Feature|Funcionalidade):/i, '').trim();
          } else if (/^(Background|Contexto|Fundo):/i.test(trimmed)) {
            backgroundSteps = [];
            currentTitle = null;
          } else if (/^(Scenario|Cenário|Cenario|Cénario):/i.test(trimmed)) {
            if (currentTitle) {
              scenarios[currentTitle] = currentSteps;
              featureByScenario[currentTitle] = currentFeature;
            }
            currentTitle = trimmed.replace(/^(Scenario|Cenário|Cenario|Cénario):/i, '').trim();
            currentSteps = [...backgroundSteps];
          } else if (/^(Given|When|Then|And|But|Dado|Quando|Então|Entao|E)\b/.test(trimmed)) {
            if (currentTitle) {
              currentSteps.push(trimmed);
            } else {
              backgroundSteps.push(trimmed);
            }
          }
        });

        if (currentTitle) {
          scenarios[currentTitle] = currentSteps;
          featureByScenario[currentTitle] = currentFeature;
        }
      }
    });
  }

  baseDirs.forEach(dir => {
    console.log(`[DEBUG] Varrendo diretório: ${dir}`);
    walk(dir);
  });
  console.log(`[DEBUG] Cenários carregados: ${Object.keys(scenarios).length}`);
  
  featureScenariosCache = { scenarios, featureByScenario };
  return featureScenariosCache;
}

function sanitizeTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function findScenarioKey(testTitle) {
  const { scenarios } = loadFeatureScenarios();

  if (scenarios[testTitle]) {
    console.log(`[DEBUG] Match exato para: "${testTitle}"`);
    return testTitle;
  }

  const normalized = testTitle.toLowerCase().trim();
  const sanitizedTest = sanitizeTitle(testTitle);

  for (const scenarioTitle of Object.keys(scenarios)) {
    const normalizedScenario = scenarioTitle.toLowerCase().trim();
    const sanitizedScenario = sanitizeTitle(scenarioTitle);

    if (
      normalizedScenario.includes(normalized) ||
      normalized.includes(normalizedScenario) ||
      sanitizedScenario === sanitizedTest ||
      sanitizedScenario.includes(sanitizedTest) ||
      sanitizedTest.includes(sanitizedScenario)
    ) {
      console.log(`[DEBUG] Match parcial: "${testTitle}" <--> "${scenarioTitle}"`);
      return scenarioTitle;
    }
  }

  console.log(`[DEBUG] NENHUM match para: "${testTitle}"`);
  return null;
}

// Encontra os passos BDD (linhas da feature) a partir do título do teste,
// usando a chave de cenário encontrada acima
function findGherkinStepsForTitle(testTitle) {
  const { scenarios } = loadFeatureScenarios();
  const key = findScenarioKey(testTitle);
  return key ? scenarios[key] : null;
}

// Encontra o nome da Feature correspondente ao título do teste
function findFeatureForTitle(testTitle) {
  const { featureByScenario } = loadFeatureScenarios();
  const key = findScenarioKey(testTitle);
  return key ? featureByScenario[key] : null;
}

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
      // Controle para imprimir o nome da Feature apenas quando mudar
      let lastFeatureName = null;

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

        // Descobre a Feature correspondente ao título do teste (cenário)
        const featureName = findFeatureForTitle(test.title);
        if (featureName && featureName !== lastFeatureName) {
          // Imprime um "título de seção" sempre que mudar de Feature
          if (doc.y > 700) {
            doc.addPage();
            doc.rect(0, 0, 600, 20).fill('#E4002B');
            doc.fillColor('black');
            doc.moveDown(2);
          }
          doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000')
             .text(`Feature: ${featureName}`);
          doc.moveDown(0.5);
          lastFeatureName = featureName;
        }

        // Título do cenário / teste
        doc.fontSize(12).font('Helvetica-Bold').fillColor('black')
           .text(`${test.title}`);
        
        // Cor do status: vermelho para falha, verde para sucesso
        const statusColor = test.status === 'failed' ? '#E4002B' : '#28a745';
        doc.fontSize(10).font('Helvetica').fillColor(statusColor)
           .text(`Status: ${test.status.toUpperCase()}`);
        
        doc.fillColor('black').moveDown(0.5);

        doc.fontSize(9).font('Helvetica-Bold').fillColor('black')
           .text(`BDD:`);
           doc.moveDown(0.5);

        // Busca passos BDD diretamente na feature (Given/When/Then/Dado/Quando/Então/E)
        const gherkinSteps = findGherkinStepsForTitle(test.title);
        // Garante que o bloco BDD será impresso apenas uma vez por teste,
        // mesmo que existam múltiplos screenshots
        let bddPrinted = true;
        
        // Imprime o BDD completo ANTES de começar a listar as evidências
        if (gherkinSteps && gherkinSteps.length > 0) {
            try {
                doc.font('Helvetica').fontSize(9).fillColor('#333333');
                gherkinSteps.forEach(line => {
                    // Verifica se precisa de nova página
                    if (doc.y > 700) {
                        doc.addPage();
                        doc.rect(0, 0, 600, 20).fill('#E4002B'); // Cabeçalho repetido
                        doc.fillColor('black');
                        doc.moveDown(2);
                        doc.font('Helvetica').fontSize(9).fillColor('#333333'); // Restaura fonte
                    }
                    if (line) {
                        doc.text(line.toString(), { align: 'left' });
                    }
                });
                doc.moveDown(1); // Espaço entre o BDD e o primeiro screenshot
            } catch (err) {
                console.error('[PDF DEBUG] Erro ao imprimir BDD:', err);
                doc.text('[Erro ao exibir passos BDD]', { color: 'red' });
            }
        }

        doc.fontSize(9).font('Helvetica-Bold').fillColor('black')
           .text(`EVIDÊNCIAS:`);
           doc.moveDown(0.5);
        // Evidências (screenshots) capturadas durante o teste
        if (test.steps && test.steps.length > 0) {

          test.steps.forEach(step => {
            // Cada passo que contém caminho de screenshot gera uma evidência visual
            if (step.screenshot && fs.existsSync(step.screenshot)) {
               // Verifica espaço na página atual antes de inserir novo bloco
               if (doc.y > 600) {
                 doc.addPage();
                 doc.rect(0, 0, 600, 20).fill('#E4002B');
                 doc.fillColor('black');
                 doc.moveDown(2);
               }
               
               try {

                // --- EXIBIR NOME DO PASSO ---
                 // Verifica se o passo tem um nome específico capturado pelo hook (ex: "Given que acesso...")
                 // Ignora nomes padrão como 'Screenshot Capturado' ou 'final_'
                 const isCustomStep = (step.step && step.step !== 'Screenshot Capturado' && !step.step.startsWith('final_'));

                 if (isCustomStep) {
                    // Se for um passo do BDD, escreve o nome dele em negrito alinhado à esquerda
                    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
                       .text(step.step, { align: 'left' });
                 } else {
                    // Se for um screenshot genérico, escreve apenas "Screenshot" centralizado
                    doc.font('Helvetica').fontSize(9).fillColor('#555555')
                       .text('Screenshot', { align: 'center' });
                 }
                 doc.moveDown(0.2);

                 //doc.font('Helvetica').fontSize(9).fillColor('#555555')
                 //   .text(`Screenshot`, { align: 'center' });
                 //
                 //doc.moveDown(0.2);

                 // --- BDD abaixo do texto "Screenshot" ---
                 // Se encontrarmos passos BDD para esse título de teste,
                 // imprimimos apenas uma vez logo abaixo de "Screenshot"
                 if (gherkinSteps && gherkinSteps.length > 0 && !bddPrinted) {
                   doc.font('Helvetica').fontSize(9).fillColor('#333333');
                   gherkinSteps.forEach(line => {
                     // Alinhamento à esquerda conforme solicitado
                     doc.text(line, { align: 'left' });
                   });
                   doc.moveDown(0.5);
                   bddPrinted = false;
                 }
                 
                 // Imagem da evidência
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

/*
  ==========================================================
  BLOCO DE EXEMPLO: AGRUPAR CENÁRIOS POR FEATURE NO PDF
  ----------------------------------------------------------
  Este trecho NÃO está em uso neste projeto, serve apenas
  como referência para copiar/colar em outros projetos.

  IDEIA:
  - Ler os arquivos .feature e montar dois mapas:
      scenarios[cenario]        -> [passos BDD]
      featureByScenario[cenario] -> "Nome da Feature"
  - No generatePdf, imprimir o nome da Feature apenas
    quando ela mudar, criando um "título de seção".
  ==========================================================

  // 1) Versão de loadFeatureScenarios que também captura o nome da Feature

  let featureScenariosCache = null;

  function loadFeatureScenarios() {
    if (featureScenariosCache) return featureScenariosCache;

    const scenarios = {};
    const featureByScenario = {};
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
          let currentFeature = null;
          let currentTitle = null;
          let currentSteps = [];
          let backgroundSteps = []; 

          content.forEach(line => {
            const trimmed = line.trim();
            if (/^(Feature|Funcionalidade):/i.test(trimmed)) {
              currentFeature = trimmed.replace(/^(Feature|Funcionalidade):/i, '').trim();
            } else if (/^(Background|Contexto|Fundo):/i.test(trimmed)) {
              backgroundSteps = [];
              currentTitle = null; 
            } else if (/^(Scenario|Cenário|Cenario|Cénario):/i.test(trimmed)) {
              if (currentTitle) {
                scenarios[currentTitle] = currentSteps;
                featureByScenario[currentTitle] = currentFeature;
              }
              currentTitle = trimmed.replace(/^(Scenario|Cenário|Cenario|Cénario):/i, '').trim();
              currentSteps = [...backgroundSteps];
            } else if (/^(Given|When|Then|And|But|Dado|Quando|Então|Entao|E)\b/.test(trimmed)) {
              if (currentTitle) currentSteps.push(trimmed);
              else backgroundSteps.push(trimmed);
            }
          });

          if (currentTitle) {
            scenarios[currentTitle] = currentSteps;
            featureByScenario[currentTitle] = currentFeature;
          }
        }
      });
    }

    baseDirs.forEach(dir => walk(dir));
    featureScenariosCache = { scenarios, featureByScenario };
    return featureScenariosCache;
  }

  // 2) Helpers para localizar cenário/feature a partir do título do teste

  function sanitizeTitle(str) {
    if (!str) return '';
    return str.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function findScenarioKey(testTitle) {
    const { scenarios } = loadFeatureScenarios();
    if (scenarios[testTitle]) return testTitle;

    const normalized = testTitle.toLowerCase().trim();
    const sanitizedTest = sanitizeTitle(testTitle);

    for (const scenarioTitle of Object.keys(scenarios)) {
      const normalizedScenario = scenarioTitle.toLowerCase().trim();
      const sanitizedScenario = sanitizeTitle(scenarioTitle);
      if (
        normalizedScenario.includes(normalized) ||
        normalized.includes(normalizedScenario) ||
        sanitizedScenario === sanitizedTest ||
        sanitizedScenario.includes(sanitizedTest) ||
        sanitizedTest.includes(sanitizedScenario)
      ) {
        return scenarioTitle;
      }
    }
    return null;
  }

  function findGherkinStepsForTitle(testTitle) {
    const { scenarios } = loadFeatureScenarios();
    const key = findScenarioKey(testTitle);
    return key ? scenarios[key] : null;
  }

  function findFeatureForTitle(testTitle) {
    const { featureByScenario } = loadFeatureScenarios();
    const key = findScenarioKey(testTitle);
    return key ? featureByScenario[key] : null;
  }

  // 3) Exemplo de uso dentro do generatePdf:
  //
  // let lastFeatureName = null;
  //
  // testResults.forEach((test) => {
  //   checkPageBreak(doc);
  //
  //   const featureName = findFeatureForTitle(test.title);
  //   if (featureName) {
  //     if (featureName !== lastFeatureName) {
  //       checkPageBreak(doc);
  //       doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000')
  //          .text(`Feature: ${featureName}`);
  //       doc.moveDown(0.5);
  //       lastFeatureName = featureName;
  //     }
  //   }
  //
  //   doc.fontSize(12).font('Helvetica-Bold').fillColor('black')
  //      .text(`${test.title}`);
  //   ...
  // });
*/

module.exports = { generatePdf };
