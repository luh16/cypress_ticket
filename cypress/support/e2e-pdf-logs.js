// --- LOGICA DE GERAÇÃO DE PDF E EVIDENCIAS ---
// Importa este arquivo no cypress/support/e2e.js para ativar a geração automática
console.log('>>> ARQUIVO E2E-PDF-LOGS.JS CARREGADO COM SUCESSO <<<');

// Variável global para armazenar os logs dos steps
const stepLogs = {};

// Hook para capturar o início de cada teste
beforeEach(function() {
  const testTitle = this.currentTest.title;
  stepLogs[testTitle] = [];
});

// Listener explícito para falhas do Cypress (GARANTE captura de erro)
Cypress.on('fail', (err, runnable) => {
    const testTitle = runnable.title;
    if (stepLogs[testTitle]) {
        stepLogs[testTitle].push({
            step: `ERRO: ${err.message}`,
            status: 'failed',
            screenshot: null,
            timestamp: new Date().toISOString()
        });
    }
    throw err; // Re-lança o erro para o Cypress falhar o teste normalmente
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
  // Captura o estado IMEDIATAMENTE, antes de qualquer comando cy.*
  // Isso evita que o estado seja perdido ou alterado durante a execução dos comandos assíncronos
  const testState = this.currentTest.state;
  const testErr = this.currentTest.err;

  // Tira screenshot final manualmente SEMPRE (garante evidência do estado final)
  
  // Gera nome curto baseado em data e hora para evitar erros de caracteres e tamanho
  const now = new Date();
  const dataFormatada = now.getFullYear() + '-' + 
                        String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(now.getDate()).padStart(2, '0') + '_' + 
                        String(now.getHours()).padStart(2, '0') + '-' + 
                        String(now.getMinutes()).padStart(2, '0') + '-' + 
                        String(now.getSeconds()).padStart(2, '0');
  
  // Sanitiza o título apenas para o screenshot (pasta)
  const sanitizedTitle = this.currentTest.title.replace(/[^a-z0-9\s-]/gi, '').trim().substring(0, 50).replace(/\s+/g, '-');
  cy.screenshot(`after-each/${sanitizedTitle}`, { capture: 'runner' });

  cy.then(() => {
    const logs = stepLogs[this.currentTest.title];
    const lastLog = logs && logs.length > 0 ? logs[logs.length - 1] : null;
    
    // Lógica robusta para determinar status final (prioriza falha)
    // Usa as variáveis capturadas no início do hook
    let finalStatus = testState;
    if (testErr) {
        finalStatus = 'failed';
    }

    // Se o teste falhou, garante que o último log reflita isso
    if (logs && logs.length > 0) {
        const lastIndex = logs.length - 1;
        if (finalStatus === 'failed') {
             logs[lastIndex].status = 'failed';
         } else {
             // Se passou, apenas atualiza o nome do passo se necessário
             if (logs[lastIndex].step === 'Screenshot Capturado') {
                  logs[lastIndex].step = this.currentTest.title;
             }
         }
    } else if (logs) {
        // Se não houve logs anteriores, cria um novo
        logs.push({
            step: this.currentTest.title,
            status: finalStatus, 
            screenshot: null,
            timestamp: new Date().toISOString()
        });
    }

    // Acumula evidência para geração posterior (consolidação)
    // if (Cypress.env('GENERATE_PDF')) { <--- Descomente para produção
    if (true) {
        cy.log('Acumulando evidência do teste...');
        
        const evidenceData = {
            title: this.currentTest.title,
            steps: stepLogs[this.currentTest.title] || [],
            status: finalStatus
        };
        
        cy.task('accumulateEvidence', evidenceData);
    }
  });
});
