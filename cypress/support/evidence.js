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

afterEach(function () {
  const tituloTeste = this.currentTest.title.replace(/[:\/]/g, '-'); // Nome do teste formatado

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