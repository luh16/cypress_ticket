// Import commands.js using ES2015 syntax:
import 'cypress-plugin-api'
import './commands'
import '@shelex/cypress-allure-plugin';

// Variável global para armazenar os logs dos steps
const stepLogs = {};

// Hook para capturar o início de cada teste
beforeEach(function() {
  const testTitle = this.currentTest.title;
  stepLogs[testTitle] = [];
});

// Listener global para capturar QUALQUER screenshot (inclusive automáticos de falha)
Cypress.Screenshot.defaults({
  capture: 'runner', // Captura a interface do Cypress (incluindo logs) para vermos o erro explicitamente
  onAfterScreenshot($el, props) {
    const testTitle = Cypress.currentTest.title;
    if (stepLogs[testTitle]) {
      const isFailure = props.path.includes('(failed)') || props.name.includes('(failed)');
      stepLogs[testTitle].push({
        step: isFailure ? "Falha Detectada (Screenshot)" : "Screenshot Capturado",
        status: isFailure ? "failed" : "screenshot",
        screenshot: props.path,
        timestamp: new Date().toISOString()
      });
    }
  }
});

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
  // const screenshotFolder = `after-each/${tituloTeste}`; // Removido pois vamos usar o nome direto no arquivo

  // Tira screenshot final manualmente SEMPRE (garante evidência do estado final)
  // O nome do arquivo será o nome do CT (tituloTeste), salvo na pasta 'after-each' para organização
  cy.screenshot(`after-each/${tituloTeste}`, {
    capture: 'runner'
  });

  cy.then(() => {
    // Recupera os logs do teste atual
    const logs = stepLogs[this.currentTest.title];
    
    // Verifica se o último log registrado foi um screenshot (provavelmente o que acabamos de tirar)
    const lastLog = logs && logs.length > 0 ? logs[logs.length - 1] : null;

    if (lastLog && lastLog.screenshot) {
        // Se o último passo já tem screenshot, apenas atualizamos o nome e status para refletir que é o Estado Final
        lastLog.step = this.currentTest.title; // Nome do CT como título do passo
        lastLog.status = this.currentTest.state;
     } else {
        // Se por algum motivo não tiver screenshot (ex: falha na captura), adicionamos o registro manual
        if (logs) {
          logs.push({
             step: this.currentTest.title, // Nome do CT como título do passo
             status: this.currentTest.state, 
             screenshot: null, 
             timestamp: new Date().toISOString()
          });
        }
     }
    
    // Salva o log em arquivo para ser lido pelo gerador de PDF
    const logsDir = 'cypress/results/logs';
    // Sanitiza o nome do arquivo para evitar erros de caracteres inválidos ou caminhos não existentes
    const safeTitle = tituloTeste.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    cy.task('ensureDir', logsDir).then(() => {
        cy.writeFile(`${logsDir}/${safeTitle}.json`, JSON.stringify(stepLogs[this.currentTest.title] || []));
    });
  })
});
