// Import commands.js using ES2015 syntax:
import 'cypress-plugin-api'
import './commands'
import '@shelex/cypress-allure-plugin';

// --- PDF: Lógica movida para arquivo separado ---
import './e2e-pdf-logs';
// Importa hook global de screenshots (passo a passo)
import './global_hooks';
// ------------------------------------------------

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

// OBS: O afterEach do PDF foi movido para e2e-pdf-logs.js
