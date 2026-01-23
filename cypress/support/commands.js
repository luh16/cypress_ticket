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


Cypress.Commands.add('loginMicrosoft', () => {
    cy.visit('/');
    cy.origin('https://login.microsoftonline.com', () => {
        const user = Cypress.env('User');
        const password = Cypress.env('Password');
        cy.get('input[type="email"]', { timeout: 20000 })
          .type(user, { force: true });
        cy.get('input[type="submit"]').click();

        cy.get('input[type="password"]', { timeout: 20000 })
          .type(password, { force: true, log: false }); 

        cy.get('input[type="submit"]').click();  
        cy.get('#idBtn_Back').click(); 
    });

    cy.url().should('include', 'edenred.net');
});
