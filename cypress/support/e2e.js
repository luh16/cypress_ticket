// Import commands.js using ES2015 syntax:
import 'cypress-plugin-api'
import './commands'
import '@shelex/cypress-allure-plugin';

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
  const screenshotFolder = `after-each/${tituloTeste}`;

  let lastScreenshotPath;
  cy.screenshot(screenshotFolder, {
    capture: 'runner',
    onAfterScreenshot: (_el,props) => {
      lastScreenshotPath = props.path; //caminho completo do screeshot
    }
  })

  cy.then(() => {
    const label = this.currentTest.state === 'failed'
    ? 'Screenshot on failure'
    : 'Screenshot on pass';  

    if (lastScreenshotPath) {
      cy.allure().fileAttachment(label, lastScreenshotPath, 'image/png')
    }

  })


  
});
