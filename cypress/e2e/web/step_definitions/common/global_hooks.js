import { AfterStep } from "@badeball/cypress-cucumber-preprocessor";

AfterStep(function ({ pickleStep, gherkinDocument }) {
  try {
    if (pickleStep && pickleStep.text) {
      
      // Tenta recuperar a keyword (Dado, Quando, Então) usando o ID do step
      let keyword = '';
      if (gherkinDocument && gherkinDocument.feature && gherkinDocument.feature.children) {
        const stepId = pickleStep.astNodeIds && pickleStep.astNodeIds[0];
        if (stepId) {
          // Coleta todos os steps (Background, Scenario, Rules)
          const allSteps = [];
          gherkinDocument.feature.children.forEach(child => {
            if (child.background && child.background.steps) allSteps.push(...child.background.steps);
            if (child.scenario && child.scenario.steps) allSteps.push(...child.scenario.steps);
            if (child.rule && child.rule.children) {
               child.rule.children.forEach(rc => {
                 if (rc.background && rc.background.steps) allSteps.push(...rc.background.steps);
                 if (rc.scenario && rc.scenario.steps) allSteps.push(...rc.scenario.steps);
               });
            }
          });
          
          const foundStep = allSteps.find(s => s.id === stepId);
          if (foundStep && foundStep.keyword) {
            keyword = foundStep.keyword;
          }
        }
      }

      // Junta Keyword + Texto (ex: "Dado " + "que acesso a página")
      const fullText = keyword + pickleStep.text;

      // Permite caracteres especiais (acentos), removendo apenas os proibidos pelo Windows
      let safeStepName = fullText.replace(/"/g, "'"); 
      safeStepName = safeStepName.replace(/[<>:"/\\|?*\x00-\x1F]/g, ''); 
      
      // Limita tamanho e remove espaços extras nas pontas
      const stepName = safeStepName.trim().substring(0, 100); 
      
      // Tira o screenshot com o nome completo (Keyword + Step)
      cy.screenshot(stepName, { capture: 'runner' });
    }
  } catch (e) {
    cy.log('Erro ao tirar screenshot do passo: ' + e.message);
  }
});
