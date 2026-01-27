import { AfterStep } from "@badeball/cypress-cucumber-preprocessor";

AfterStep(function ({ pickleStep }) {
  try {
    if (pickleStep && pickleStep.text) {
      // Permite acentuação e caracteres especiais comuns em PT-BR, mas remove inválidos para arquivo
      const safeStepName = pickleStep.text.replace(/[^a-zA-Z0-9\s-_\u00C0-\u00FF]/g, '').trim();
      
      // Limita tamanho para evitar erros de filesystem
      const stepName = safeStepName.substring(0, 100); 
      
      // Tira o screenshot. O nome será capturado pelo e2e-pdf-logs.js
      // Removemos overwrite:true para que passos repetidos gerem (1), (2), etc.
      cy.screenshot(stepName, { capture: 'runner' });
    }
  } catch (e) {
    cy.log('Erro ao tirar screenshot do passo: ' + e.message);
  }
});
