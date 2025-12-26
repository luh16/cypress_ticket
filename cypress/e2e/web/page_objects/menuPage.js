require('cypress-xpath');
import PageBase from '../page_helper/HelperPage';

export default class MenuPage extends PageBase {
    elements = {
      menuReceivable:             () => cy.xpath('//h2[text()="Receivable"]'),
      menuOpPrincipal:       (menu) => cy.xpath(`//span[text()="${menu}"]`), //span[text()="Nova Solicitação"]
    }
  

    clickMenuReiceivable() {
      this.elements.menuReceivable().click()
    }

    clickMenuOp(menu) {
      this.elements.menuOpPrincipal(menu).click()
    }



    
    
  }
  
  //
  