// Biblioteca para criar o PDF
const PDFDocument = require('pdfkit');
// Acesso ao sistema de arquivos (ler .feature, verificar imagens etc.)
const fs = require('fs');
// Montar caminhos de forma segura (independente de SO)
const path = require('path');

// --- CONFIGURAÇÕES E CONSTANTES ---

// Cache para evitar ler arquivos repetidamente
let featureScenariosCache = null;

// Padrões Regex para identificar elementos Gherkin (.feature)
// Simplifica a leitura e manutenção dos padrões de texto
const REGEX_BACKGROUND = /^(Background|Contexto|Fundo):/i;
const REGEX_SCENARIO   = /^(Scenario|Cenário|Cenario|Cénario):/i;
const REGEX_STEPS      = /^(Given|When|Then|And|But|Dado|Quando|Então|Entao|E)\b/;

// --- FUNÇÕES AUXILIARES DE LEITURA DE FEATURE ---

/**
 * Lê todos os arquivos .feature e mapeia os cenários.
 * Retorna um objeto: { "Título do Cenário": ["Passo 1", "Passo 2", ...] }
 */
function loadFeatureScenarios() {
  if (featureScenariosCache) return featureScenariosCache;

  const scenarios = {};
  
  // Diretórios onde o script buscará arquivos .feature
  const baseDirs = [
    path.join(process.cwd(), 'cypress', 'e2e'),
    path.join(process.cwd(), 'cypress', 'web', 'features')
  ];

  // Função recursiva para percorrer pastas e subpastas
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        walk(fullPath); // Continua descendo na árvore de diretórios
      } else if (entry.isFile() && entry.name.endsWith('.feature')) {
        parseFeatureFile(fullPath, scenarios);
      }
    });
  }

  // Executa a varredura
  baseDirs.forEach(dir => {
    console.log(`[DEBUG] Varrendo diretório: ${dir}`);
    walk(dir);
  });

  console.log(`[DEBUG] Cenários carregados: ${Object.keys(scenarios).length}`);
  
  featureScenariosCache = scenarios;
  return featureScenariosCache;
}

/**
 * Lê um arquivo .feature específico e popula o objeto de cenários.
 * Lógica extraída para simplificar a função principal.
 */
function parseFeatureFile(filePath, scenariosMap) {
  const content = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);

  let currentTitle = null;
  let currentSteps = [];
  let backgroundSteps = []; // Passos do Contexto/Fundo (comuns a todos os cenários do arquivo)

  content.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return; // Pula linhas vazias

    // 1. Identifica Contexto/Background
    if (REGEX_BACKGROUND.test(trimmed)) {
      backgroundSteps = [];
      currentTitle = null; // Reseta pois estamos definindo passos globais
    
    // 2. Identifica Início de Cenário
    } else if (REGEX_SCENARIO.test(trimmed)) {
      saveCurrentScenario(scenariosMap, currentTitle, currentSteps);
      
      // Limpa nome do cenário (remove "Scenario: ") e inicia novos passos herdando o Background
      currentTitle = trimmed.replace(REGEX_SCENARIO, '').trim();
      currentSteps = [...backgroundSteps];

    // 3. Identifica Passos (Given/When/Then...)
    } else if (REGEX_STEPS.test(trimmed)) {
      if (currentTitle) {
        currentSteps.push(trimmed);     // Adiciona ao cenário atual
      } else {
        backgroundSteps.push(trimmed);  // Adiciona ao background (se nenhum cenário iniciou ainda)
      }
    }
  });

  // Salva o último cenário do arquivo, se houver
  saveCurrentScenario(scenariosMap, currentTitle, currentSteps);
}

// Helper para salvar cenário no mapa se ele for válido
function saveCurrentScenario(map, title, steps) {
  if (title && steps.length > 0) {
    map[title] = steps;
  }
}

// --- FUNÇÕES AUXILIARES DE BUSCA E FORMATAÇÃO ---

// Normaliza strings para facilitar a comparação (remove acentos e caracteres especiais)
function sanitizeTitle(str) {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, ''); // Mantém apenas letras e números
}

/**
 * Busca os passos BDD correspondentes ao título do teste executado.
 * Tenta match exato e depois match parcial/aproximado.
 */
function findGherkinStepsForTitle(testTitle) {
  const scenarios = loadFeatureScenarios();

  // 1. Tentativa de Match Exato (Mais rápido e preciso)
  if (scenarios[testTitle]) {
      console.log(`[DEBUG] Match exato: "${testTitle}"`);
      return scenarios[testTitle];
  }

  // 2. Tentativa de Match Parcial (Para casos com pequenas diferenças de formatação)
  const normalizedTest = sanitizeTitle(testTitle);
  const rawTestLower = testTitle.toLowerCase().trim();

  for (const [scenarioTitle, steps] of Object.entries(scenarios)) {
    const normalizedScenario = sanitizeTitle(scenarioTitle);
    const rawScenarioLower = scenarioTitle.toLowerCase().trim();
    
    if (
      normalizedScenario === normalizedTest ||
      rawScenarioLower.includes(rawTestLower) ||
      rawTestLower.includes(rawScenarioLower) ||
      normalizedScenario.includes(normalizedTest) ||
      normalizedTest.includes(normalizedScenario)
    ) {
      console.log(`[DEBUG] Match parcial: "${testTitle}" <--> "${scenarioTitle}"`);
      return steps;
    }
  }

  console.log(`[DEBUG] NENHUM match para: "${testTitle}"`);
  return null;
}

// --- GERAÇÃO DO PDF ---

/**
 * Função principal que gera o relatório PDF.
 */
async function generatePdf(testResults, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Renderiza Cabeçalho da Primeira Página
      renderHeader(doc);

      // Define posição inicial
      doc.y = 130;
      doc.moveDown();

      // Loop pelos testes executados
      testResults.forEach((test) => {
        // Verifica se precisa criar nova página
        checkPageBreak(doc, 700);

        // Renderiza Título e Status
        renderTestTitleAndStatus(doc, test);

        // Busca passos BDD (Gherkin) associados
        const gherkinSteps = findGherkinStepsForTitle(test.title);
        let bddPrinted = false; // Flag para não repetir BDD se houver múltiplos screenshots
        
        // Se houver evidências (screenshots)
        if (test.steps && test.steps.length > 0) {
          test.steps.forEach(step => {
            if (step.screenshot && fs.existsSync(step.screenshot)) {
               
               // Verifica quebra de página específica para imagem (precisa de mais espaço)
               checkPageBreak(doc, 600);
               
               try {
                 const isCustomStep = (step.step && step.step !== 'Screenshot Capturado' && !step.step.startsWith('final_'));

                 if (isCustomStep) {
                    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
                       .text(step.step, { align: 'left' });
                 } else {
                    doc.font('Helvetica').fontSize(9).fillColor('#555555')
                       .text('Screenshot', { align: 'center' });
                 }
                 doc.moveDown(0.2);

                 // Imprime BDD apenas na primeira evidência do teste
                 if (gherkinSteps && gherkinSteps.length > 0 && !bddPrinted) {
                   renderGherkinSteps(doc, gherkinSteps);
                   bddPrinted = true;
                 }
                 
                 // Renderiza a Imagem
                 doc.image(step.screenshot, { fit: [450, 250], align: 'center' });
                 doc.moveDown(1);

               } catch (err) {
                 doc.text('[Erro ao carregar imagem]', { color: 'red' });
               }
            }
          });
        }
        
        // Linha separadora
        renderSeparator(doc);
      });

      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', (err) => reject(err));

    } catch (err) {
      reject(err);
    }
  });
}

// --- HELPERS DE RENDERIZAÇÃO DO PDF ---

function renderHeader(doc) {
  // Faixa Vermelha
  doc.rect(0, 0, 600, 20).fill('#E4002B'); 

  // Logo
  const logoPath = 'cypress/fixtures/logo-oficial.png';
  if (fs.existsSync(logoPath)) {
    try { doc.image(logoPath, 450, 40, { fit: [100, 50], align: 'right' }); } catch (e) {}
  }

  // Textos
  doc.fillColor('black').fontSize(14).font('Helvetica-Bold')
     .text('TICKET | EDENRED', 50, 50, { align: 'left' });
  doc.fontSize(12).font('Helvetica')
     .text('QA Automação', 50, 70, { align: 'left' });
  doc.fontSize(10).fillColor('#555555')
     .text(`Data: ${new Date().toLocaleString()}`, 50, 90, { align: 'left' });
}

function checkPageBreak(doc, limitY) {
  if (doc.y > limitY) {
    doc.addPage();
    doc.rect(0, 0, 600, 20).fill('#E4002B'); // Repete faixa no topo
    doc.fillColor('black');
    doc.moveDown(2);
  }
}

function renderTestTitleAndStatus(doc, test) {
  doc.fontSize(12).font('Helvetica-Bold').fillColor('black')
     .text(`${test.title}`);
  
  const statusColor = test.status === 'failed' ? '#E4002B' : '#28a745';
  doc.fontSize(10).font('Helvetica').fillColor(statusColor)
     .text(`Status: ${test.status.toUpperCase()}`);
  
  doc.fillColor('black').moveDown(0.5);
}

function renderGherkinSteps(doc, steps) {
  doc.font('Helvetica').fontSize(9).fillColor('#333333');
  steps.forEach(line => {
    // Alinhamento à esquerda para melhor leitura dos passos
    doc.text(line, { align: 'left' });
  });
  doc.moveDown(0.5);
}

function renderSeparator(doc) {
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke();
  doc.moveDown(1);
}

module.exports = { generatePdf };
