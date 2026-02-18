// Biblioteca para criar o PDF
const PDFDocument = require('pdfkit');
// Acesso ao sistema de arquivos (ler .feature, verificar imagens etc.)
const fs = require('fs');
// Montar caminhos de forma segura (independente de SO)
const path = require('path');

// Cache em memória dos cenários BDD já lidos das features
let featureScenariosCache = null;

// Lê todos os arquivos .feature e monta um mapa:
// "Título do Scenario" -> [linhas Given/When/Then/And/Dado/Quando/Então/E...]
function loadFeatureScenarios() {
  if (featureScenariosCache) return featureScenariosCache;

  const scenarios = {};
  // Suporta duas estruturas de projeto:
  // - cypress/e2e
  // - cypress/web/features
  const baseDirs = [
    path.join(process.cwd(), 'cypress', 'e2e'),
    path.join(process.cwd(), 'cypress', 'web', 'features')
  ];

  // Percorre recursivamente as pastas atrás de arquivos .feature
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.feature')) {
        // Lê o conteúdo da feature linha a linha
        const content = fs.readFileSync(fullPath, 'utf-8').split(/\r?\n/);

        let currentTitle = null;
        let currentSteps = [];
        let backgroundSteps = []; // Armazena passos do Contexto/Background

        // Para cada linha da feature, identifica Contexto, Scenario e passos BDD
        content.forEach(line => {
          const trimmed = line.trim();

          // 1. Verifica se é Contexto/Background
          // (Se encontrar, limpa passos anteriores de background e define que não estamos mais em um cenário específico)
          if (/^(Background|Contexto|Fundo):/i.test(trimmed)) {
            backgroundSteps = [];
            currentTitle = null; // Garante que passos seguintes sejam capturados como background
          
          // 2. Verifica se é Scenario (ou Cénario/Cenário)
          } else if (/^(Scenario|Cenário|Cenario|Cénario):/i.test(trimmed)) {
            // Se já estávamos lendo um cenário anterior, salva ele antes de começar o novo
            if (currentTitle) {
              scenarios[currentTitle] = currentSteps;
            }
            // Extrai o título do cenário removendo o prefixo
            currentTitle = trimmed.replace(/^(Scenario|Cenário|Cenario|Cénario):/i, '').trim();
            // Inicia os passos deste cenário herdando os passos do Background atual
            currentSteps = [...backgroundSteps];

          // 3. Verifica se é um passo BDD (Given/When/Then/And/But ou versões em PT)
          } else if (/^(Given|When|Then|And|But|Dado|Quando|Então|Entao|E)\b/.test(trimmed)) {
            // Se estamos dentro de um cenário, adiciona aos passos do cenário
            if (currentTitle) {
              currentSteps.push(trimmed);
            } else {
              // Se não tem cenário ativo, assume que é parte do Background
              backgroundSteps.push(trimmed);
            }
          }
        });

        // Garante que o último cenário lido seja salvo no mapa
        if (currentTitle) {
          scenarios[currentTitle] = currentSteps;
        }
      }
    });
  }

  baseDirs.forEach(dir => {
    console.log(`[DEBUG] Varrendo diretório: ${dir}`);
    walk(dir);
  });
  console.log(`[DEBUG] Cenários carregados: ${Object.keys(scenarios).length}`);
  // console.log(`[DEBUG] Títulos encontrados:`, Object.keys(scenarios)); 
  
  featureScenariosCache = scenarios;
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

// Encontra os passos BDD (linhas da feature) a partir do título do teste
// - Primeiro tenta match exato com o título do Scenario
// - Depois tenta match "contém" em lowercase (mais flexível)
function findGherkinStepsForTitle(testTitle) {
  const scenarios = loadFeatureScenarios();

  if (scenarios[testTitle]) {
      console.log(`[DEBUG] Match exato para: "${testTitle}"`);
      return scenarios[testTitle];
  }

  const normalized = testTitle.toLowerCase().trim();
  const sanitizedTest = sanitizeTitle(testTitle);
  for (const [scenarioTitle, steps] of Object.entries(scenarios)) {
    const normalizedScenario = scenarioTitle.toLowerCase().trim();
    const sanitizedScenario = sanitizeTitle(scenarioTitle);
    
    // Tenta match parcial
    if (
      normalizedScenario.includes(normalized) ||
      normalized.includes(normalizedScenario) ||
      sanitizedScenario === sanitizedTest ||
      sanitizedScenario.includes(sanitizedTest) ||
      sanitizedTest.includes(sanitizedScenario)
    ) {
      console.log(`[DEBUG] Match parcial: "${testTitle}" <--> "${scenarioTitle}"`);
      return steps;
    }
  }

  console.log(`[DEBUG] NENHUM match para: "${testTitle}"`);
  return null; // Não encontrou nenhum cenário correspondente
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

      doc.fontSize(10).fillColor('#555555')
         .text('Squad: Recebíveis', 50, 90, { align: 'left' });

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

module.exports = { generatePdf };
