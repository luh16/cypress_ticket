require('cypress-xpath');
import PageBase from '../../page_helper/HelperPage';

export default class NovaSolicitacaoPage extends PageBase {
    elements = {
      tipoDeExtrato:                          () => cy.xpath('//select[@data-testid="extractType"]'),
      campoContrato:                          () => cy.xpath('//input[@name="contractNumber"]'),
      campoReembolso:                         () => cy.xpath('//input[@name="refundNumber"]'),
      campoCNPJ:                              () => cy.xpath('//input[@name="cnpjNumber"]'),
      campoPeriodoInicio:                     () => cy.xpath('(//input[@name="date"])[1]'), //
      campoPeriodoFim:                        () => cy.xpath('(//input[@name="date"])[2]'), //
      campoNumeroDoProtocolo:                 () => cy.xpath('//input[@name="protocolNumber"]'),
      campoNomeDoSolicitante:                 () => cy.xpath('//input[@name="requesterName"]'),
      campoEmailDoSolicitante:                () => cy.xpath('//input[@name="requesterEmail"]'),
      botaoNovaSolicitacao:                   () => cy.xpath('//button[text()="Criar nova solicitação"]'),
      flagEnviarProEmail:                     () => cy.xpath('//input[@type="checkbox"]'),
       
      campoNumeroProtocolo:                   () => cy.xpath('//input[@name="protocolNumber"]'),
      campoNomeSolicitante:                   () => cy.xpath('//input[@name="requesterName"]'),
      campoEmailSolicitante:                  () => cy.xpath('//input[@name="requesterEmail"]'),


      modalDeSucessoMensagem:                 () => cy.get('.sc-gJiVIX > h2'),


    }
  
   // loginMicrosoft() {
   // cy.visit('/'); 
   // cy.origin('https://login.microsoftonline.com', () => {
   //     cy.get('input[type="email"]', { timeout: 20000 })
   //       .type(Cypress.env('User'), { force: true });
   //     cy.get('input[type="submit"]').click();
   //     cy.get('input[type="password"]', { timeout: 20000 })
   //       .type(Cypress.env('Password'), { force: true }); 
   //     cy.get('input[type="submit"]').click();  
   //     cy.get('#idBtn_Back').click(); 
   // });
   // cy.url().should('include', 'edenred.net');
   //}

    selecionarTipoDeExtrato(tipoExtrato) {
      this.elements.tipoDeExtrato().select(tipoExtrato)
    }

    preencherCampoReembolso(numeroReembolso) {
      this.elements.campoReembolso().type(numeroReembolso, {force: true}) 
    }

    ClickFlagEnviarPorEmail() {
      this.elements.flagEnviarProEmail().click({force: true}) 
    }

    preencherCampoPeriodo() { 
      this.elements.campoPeriodoInicio().type("2020-12-22") 
      this.sendKeysDataGerarAtual(this.elements.campoPeriodoFim)
    }

    botaoCriarNovaSolicitacao() {
      this.elements.botaoNovaSolicitacao().click()
    }

    preencherDadosEnviarPorEmail() {
      this.elements.campoNumeroProtocolo().type("123456", {force: true})
      this.elements.campoNomeSolicitante().type("luiz choque", {force: true})
      this.elements.campoEmailSolicitante().type("luiz.choque@consulting-for.edenred.com", {force: true})
    }
    
    
 
    validarCamposExtratoSimplificado(){
        this.elements.campoContrato().should('be.visible')
        this.elements.campoReembolso().should('be.visible')
        this.elements.campoPeriodoInicio().should('be.visible')
        this.elements.campoPeriodoFim().should('be.visible')
        this.elements.campoNumeroDoProtocolo().should('be.visible')
        this.elements.campoNomeDoSolicitante().should('be.visible')
        this.elements.campoEmailDoSolicitante().should('be.visible')
    }

    validarCamposExtratoDetalhado(){
        this.elements.campoContrato().should('be.visible')
        this.elements.campoReembolso().should('be.visible')
        this.elements.campoPeriodo().should('be.visible')
        this.elements.campoNumeroDoProtocolo().should('be.visible')
        this.elements.campoNomeDoSolicitante().should('be.visible')
        this.elements.campoEmailDoSolicitante().should('be.visible')
        this.elements.campoCNPJ().should('be.visible')
    }

    modalDeSucesso(){
      this.elements.modalDeSucessoMensagem().should('have.text', 'Sucesso');
      //this.visibleContainsAlert(this.elements.modalDeSucessoMensagem,'Sucesso')
    }
    
   
  }
  
  //
  