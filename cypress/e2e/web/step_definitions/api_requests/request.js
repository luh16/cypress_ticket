import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';
import GetRequest from '../../../../support/api/get/get_teste';


//instanciando as classes
const getRequest = new GetRequest()
var response

Given("que acesso o portal merchants hub via api", () => {
  //cy.visit('/'); sem isso ele vai ler o arquivo env
});

When('que realizo login no endpoint {string}', (endpoint) => {
getRequest.login(endpoint).then((res) => {
    response = res; 
  });
});


Then('validar elementos modal Nao foi Possivel Acessar a Conta api', () => {

  expect(response.status).to.be.oneOf([200, 201]);
  
  // 1. Chame o comando customizado:
  cy.readDownloadedExcel()
    // 2. Use `.then()` para acessar os DADOS que o comando retornou:
    .then((excelData) => {
      
      // 3. Dentro deste bloco '.then()', você tem acesso total aos dados JSON do Excel
      cy.log('Dados lidos:', excelData);

      // E pode fazer suas validações (assertions) normalmente:
      expect(excelData).to.be.an('array').and.to.not.be.empty;
      //expect(excelData.length).to.equal(5);
      expect(excelData[0]).to.have.property('Nome');
      expect(excelData[0].Nome).to.equal('Luiz');
      expect(excelData[0]).to.have.property('Função');
      expect(excelData[0].Função).to.equal('QAA');
    });

});




