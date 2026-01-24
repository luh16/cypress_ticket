// Variável local para guardar logs do teste atual
let currentTestLogs = [];

// Limpa logs antes de cada teste
beforeEach(() => {
  currentTestLogs = [];
});

// Captura falhas
Cypress.on('fail', (error, runnable) => {
  currentTestLogs.push({
    step: `ERRO: ${error.message}`,
    status: 'failed',
    timestamp: new Date().toISOString()
  });
  throw error;
});

// Captura Screenshots (automáticos ou manuais)
Cypress.Screenshot.defaults({
  onAfterScreenshot($el, props) {
    currentTestLogs.push({
      step: 'Screenshot Capturado',
      screenshot: props.path,
      timestamp: new Date().toISOString()
    });
  }
});

// Ao final de cada teste, envia dados para o acumulador
afterEach(function() {
  const testStatus = this.currentTest.state;
  const testTitle = this.currentTest.title;
  
  // Tira um print final para garantir evidência
  const sanitizedTitle = testTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
  cy.screenshot(`final_${sanitizedTitle}`, { capture: 'runner' });

  cy.then(() => {
    const data = {
      title: testTitle,
      status: testStatus,
      steps: currentTestLogs
    };

    cy.task('accumulateEvidence', data);
  });
});
