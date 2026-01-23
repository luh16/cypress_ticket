// Import commands.js using ES2015 syntax:
import 'cypress-plugin-api'
import './commands'
import '@shelex/cypress-allure-plugin';

// --- PDF: COPIAR ESTE BLOCO (INICIO) ---
// Variável global para armazenar os logs dos steps
const stepLogs = {};

// Hook para capturar o início de cada teste
beforeEach(function() {
  const testTitle = this.currentTest.title;
  stepLogs[testTitle] = [];
});

// Listener global para capturar screenshots
Cypress.Screenshot.defaults({
  capture: 'runner',
  onAfterScreenshot($el, props) {
    const testTitle = Cypress.currentTest.title;
    if (stepLogs[testTitle]) {
      const isFailure = props.path.includes('(failed)') || props.name.includes('(failed)');
      stepLogs[testTitle].push({
        step: isFailure ? "Falha Detectada" : "Screenshot Capturado",
        status: isFailure ? "failed" : "screenshot",
        screenshot: props.path,
        timestamp: new Date().toISOString()
      });
    }
  }
});
// --- PDF: COPIAR ESTE BLOCO (FIM) ---

// Tratamento de exceções não capturadas
Cypress.on('uncaught:exception', (err, runnable) => {
  // retornando false impede que o Cypress falhe o teste
  console.log('Erro não capturado:', err.message)
  return false
})


beforeEach(() => { 
  
  
  // Bloqueia domínios de anúncios e scripts de terceiros para evitar lentidão e erros
  const blockedDomains = [
    'ad.plus',
    'googlesyndication.com',
    'doubleclick.net',
    '33across.com',
    'openx.net',
    'criteo.com',
    'pubmatic.com',
    'id5-sync.com',
    'securepubads.g.doubleclick.net',
    'ad.mrtnsvr.com',
    'oajs.openx.net',
    'cdn-ima.33across.com',
    'ad.doubleclick.net',
    'google-analytics.com',
    'gampad/ads',
  ];
  blockedDomains.forEach(domain => {
    cy.intercept({
      url: `*${domain}*`
    }, {
      statusCode: 204,
      body: ''
    });
  });
  Cypress.Commands.add('fecharModais', () => {
    const modais = [
      '.x-tool.x-tool-close',
      '.popupBoxClose'
    ];

  modais.forEach((seletor) => {
    cy.get('body', { timeout: 5000 }).then(($body) => {
      const modal = $body.find(seletor);
      if (modal.length > 0 && modal.is(':visible')) {
        cy.wrap(modal.first()).click({ force: true });
      }
    });
  });
});

});

afterEach(function () {
  const tituloTeste = this.currentTest.title.replace(/[:\/]/g, '-'); // Nome do teste formatado

  // Tira screenshot final manualmente SEMPRE (garante evidência do estado final)
  cy.screenshot(`after-each/${tituloTeste}`, { capture: 'runner' });

  cy.then(() => {
    // --- PDF: COPIAR ESTE BLOCO NO FINAL DO AFTER EACH (INICIO) ---
    const logs = stepLogs[this.currentTest.title];
    const lastLog = logs && logs.length > 0 ? logs[logs.length - 1] : null;

    if (lastLog && lastLog.screenshot) {
        lastLog.step = this.currentTest.title;
        lastLog.status = this.currentTest.state;
    } else if (logs) {
        logs.push({
            step: this.currentTest.title,
            status: this.currentTest.state, 
            screenshot: null,
            timestamp: new Date().toISOString()
        });
    }

    // Só gera o PDF se a variável de ambiente estiver ativa
    if (Cypress.env('GENERATE_PDF')) {
        const pdfDir = 'cypress/evidence';
        const pdfName = `${tituloTeste}.pdf`;
        const pdfPath = `${pdfDir}/${pdfName}`;

        const options = {
            outputFile: pdfPath,
            steps: stepLogs[this.currentTest.title] || [],
            companyName: 'TICKET | EDENRED',
            environmentName: 'QA', 
            qaName: 'QA Automation',
            device: 'Web',
            date: new Date().toLocaleString()
        };
        
        cy.task('generatePdfTask', options);
    }
    // --- PDF: COPIAR ESTE BLOCO NO FINAL DO AFTER EACH (FIM) ---
  });
});
