import { AfterStep } from "@badeball/cypress-cucumber-preprocessor";

AfterStep(function ({ pickleStep }) {
  try {
    if (pickleStep && pickleStep.text) {
      // Permite caracteres especiais, substituindo apenas os proibidos pelo Windows
      let safeStepName = pickleStep.text.replace(/"/g, "'"); // Troca aspas duplas por simples
      safeStepName = safeStepName.replace(/[<>:"/\\|?*\x00-\x1F]/g, ''); // Remove caracteres inválidos para pasta/arquivo
      
      // Limita tamanho para evitar erros de filesystem
      const stepName = safeStepName.trim().substring(0, 100); 
      
      // Tira o screenshot. O nome será capturado pelo e2e-pdf-logs.js
      // Removemos overwrite:true para que passos repetidos gerem (1), (2), etc.
      cy.screenshot(stepName, { capture: 'runner' });
    }
  } catch (e) {
    cy.log('Erro ao tirar screenshot do passo: ' + e.message);
  }
});
