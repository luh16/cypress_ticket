// --- LOGICA DE GERAÇÃO DE PDF E EVIDENCIAS ---
// Importa este arquivo no cypress/support/e2e.js para ativar a geração automática

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

// Hook final para consolidar evidências e gerar PDF
afterEach(function () {
  const tituloTeste = this.currentTest.title.replace(/[:\/]/g, '-'); // Nome do teste formatado

  // Tira screenshot final manualmente SEMPRE (garante evidência do estado final)
  cy.screenshot(`after-each/${tituloTeste}`, { capture: 'runner' });

  cy.then(() => {
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
  });
});
