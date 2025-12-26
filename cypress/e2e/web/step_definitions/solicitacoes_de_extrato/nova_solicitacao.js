import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';
import NovaSolicitacaoPage from '../../page_objects/nova_solicitacao/novaSolicitacaoPage';
import MenuPage from '../../page_objects/menuPage';

//instanciando as classes
const menuPage = new MenuPage()
const novaSolicitacaoPage = new NovaSolicitacaoPage()


Given("que acesso o portal merchants hub Receivable", () => {
  cy.visit('/');
  //novaSolicitacaoPage.loginMicrosoft()
  menuPage.clickMenuReiceivable()
});

When('acessar menu {string}', (menu) => {
   
  menuPage.clickMenuOp(menu)
});

When('seleciono tipo de extrato {string}', (tipoExtrato) => {
 
  novaSolicitacaoPage.selecionarTipoDeExtrato(tipoExtrato)
});

When('preencho o campo Reembolso com o numero {string}', (numeroReembolso) => {
  novaSolicitacaoPage.preencherCampoReembolso(numeroReembolso)
});

When('clico no botão Criar nova solicitação', () => {
  novaSolicitacaoPage.botaoCriarNovaSolicitacao()
});


Then('deve conter os campos Contrato, Reembolso, Período, Número do Protocolo, Nome do Solicitante, Email do Solicitante', () => {
  //cadastroPage.cadastroCriadoComSucesso('The account has been successfully created!')
  novaSolicitacaoPage.validarCamposExtratoSimplificado()
});

Then('deve conter os campos Contrato, Reembolso, CNPJ, Período, Número do Protocolo, Nome do Solicitante, Email do Solicitante', () => {
  novaSolicitacaoPage.validarCamposExtratoDetalhado()
});


Then('deve aparecer modal de sucesso', () => {
  
});


