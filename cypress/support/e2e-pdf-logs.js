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
  const tituloTeste = this.currentTest.title.replace(/[:\/]/g, '-'); // Nome do teste formatado

  // Tira screenshot final manualmente SEMPRE (garante evidência do estado final)
  cy.screenshot(`after-each/${tituloTeste}`, { capture: 'runner' });

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
            // Adiciona indicador visual no texto do passo também
            if (!logs[lastIndex].step.includes('Falha')) {
                logs[lastIndex].step = `[FALHA] ${logs[lastIndex].step}`;
            }
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

    // Gera o PDF (removido check de env var para garantir execução no teste manual)
    // if (Cypress.env('GENERATE_PDF')) { <--- Descomente para produção
    if (true) { 
        cy.log('Gerando PDF de evidências...');
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
