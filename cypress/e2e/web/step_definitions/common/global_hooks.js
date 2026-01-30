import { AfterStep } from "@badeball/cypress-cucumber-preprocessor";

// Helper: Busca a keyword (Dado, Quando...) recursivamente na estrutura do Gherkin
const findStepKeyword = (children, stepId) => {
  for (const child of children) {
    // Busca em Background e Scenario
    const steps = [
      ...(child.background?.steps || []),
      ...(child.scenario?.steps || [])
    ];
    const found = steps.find(s => s.id === stepId);
    if (found) return found.keyword;

    // Busca recursiva dentro de Rules
    if (child.rule?.children) {
      const keyword = findStepKeyword(child.rule.children, stepId);
      if (keyword) return keyword;
    }
  }
  return '';
};

AfterStep(function ({ pickleStep, gherkinDocument }) {
  // Se não tiver texto ou documento, ignora
  if (!pickleStep?.text || !gherkinDocument?.feature?.children) return;

  try {
    // 1. Tenta achar a keyword (Dado, Quando, Então)
    const stepId = pickleStep.astNodeIds?.[0];
    const keyword = stepId ? findStepKeyword(gherkinDocument.feature.children, stepId) : '';

    // 2. Monta o nome completo (ex: "Dado que acesso...")
    const fullText = `${keyword}${pickleStep.text}`;

    // 3. Sanitiza para ser um nome de arquivo válido no Windows
    const safeName = fullText
      .replace(/"/g, "'") // Aspas duplas viram simples
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove caracteres proibidos
      .trim()
      .substring(0, 100); // Limita tamanho

    // 4. Tira o screenshot
    cy.screenshot(safeName, { capture: 'runner' });

  } catch (e) {
    console.error('Erro ao capturar screenshot:', e);
  }
});
