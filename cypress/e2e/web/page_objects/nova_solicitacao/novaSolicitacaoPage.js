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

    }
  
    loginMicrosoft() {
    cy.visit('/'); 
    cy.origin('https://login.microsoftonline.com', () => {
        // Dentro do origin, você deve re-declarar seletores ou usar strings diretas
        cy.get('input[type="email"]', { timeout: 20000 })
          .type("luiz.choque@consulting-for.edenred.com", { force: true });
        cy.get('input[type="submit"]').click();
        cy.get('input[type="password"]', { timeout: 20000 })
          .type("Pandemonio#1613", { force: true }); 
        cy.get('input[type="submit"]').click();  
        // Se houver a pergunta "Continuar conectado?", clique em "Sim"
        cy.get('#idBtn_Back').click(); 
    });
    // 3. Após o bloco origin, o Cypress volta para sua baseUrl automaticamente
    cy.url().should('include', 'edenred.net');
}

    selecionarTipoDeExtrato(tipoExtrato) {
      this.elements.tipoDeExtrato().select(tipoExtrato)
    }

    preencherCampoReembolso(numeroReembolso) {
      this.elements.campoReembolso().type(numeroReembolso, {force: true}) 
    }

    preencherCampoPeriodo() { 
      this.elements.campoPeriodoInicio().type("2020-12-22") 
      this.sendKeysDataGerarAtual(this.elements.campoPeriodoFim)
    }

    botaoCriarNovaSolicitacao() {
      this.elements.botaoNovaSolicitacao().click()
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
    
    
  }
  
  //
  