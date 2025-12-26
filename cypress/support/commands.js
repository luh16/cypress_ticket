// cypress/support/e2e.js (ou commands.js)

// Mantém todos os imports e configurações existentes...

// Adiciona o comando customizado 'readDownloadedExcel'
Cypress.Commands.add('readDownloadedExcel', () => {
  // Este comando encapsula a chamada para a tarefa Node configurada no cypress.config.js
  return cy.task('readExcelFile').then((data) => {
    // 'data' é o conteúdo do Excel já convertido para JSON pela tarefa Node
    // Retorna os dados para que possam ser usados com .then() nos steps
    return data; 
  });
});


