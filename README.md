
## 🏗️ Arquitetura do Projeto

### 1. **BDD com Cucumber**

### 2. **Step Definitions**

### 3. **Page Object Model (POM)**

### **Git Flow - Branchs**

- Feat:     Implementação de nova funcionalidade
- Fix:      Resolução de problemas no código
- Refactor: Refatoração de código ou ajustes
- Doc:      Alterações na documentação do projeto

**Vantagens do POM:**
- 🔄 Reutilização de código
- 🛠️ Manutenção facilitada
- 📖 Código mais legível
- 🎯 Separação de responsabilidades

## 📊 Integração com Allure Report

### Configuração Automática

O projeto está configurado para:
- ✅ Capturar screenshots automaticamente
- 📋 Gerar relatórios detalhados
- 🔗 Anexar evidências em caso de falha

### package.json - Scripts e Dependências

### Configuração do Cucumber
```json
"cypress-cucumber-preprocessor": {
  "json": {
    "enabled": false
  },
  "stepDefinitions": [
    "cypress/e2e/step_definitions/[filepath]*.{js,ts}",
    "cypress/e2e/step_definitions/*.{js,ts}"
  ]
}
```

## 🎓 Boas Práticas

### 1. **Organização de Testes**
- 📝 Use nomes descritivos nos cenários
- 🏷️ Agrupe cenários relacionados na mesma feature
- 📊 Utilize dados de teste em fixtures
- 🔄 Reutilize steps entre diferentes features

### 2. **Page Objects**
- 🎯 Uma classe por página
- 🔍 Seletores centralizados no objeto `elements`
- 🛠️ Métodos específicos para cada ação
- 🏗️ Herança da classe `HelperPage` para métodos comuns

### 3. **Step Definitions**
- 🔄 Reutilize steps entre cenários
- 📋 Mantenha steps simples e focados
- 🏷️ Use parâmetros para flexibilidade
- 📊 Adicione anotações Allure para melhor rastreabilidade

### 4. **Relatórios Allure**
- 📸 Screenshots automáticos configurados
- 📊 Anotações para melhor rastreabilidade
- 🔗 Anexos para evidências
- 🏷️ Categorização por feature e story


## 📸 Screenshots Automáticos

Configurado para capturar screenshots:
- ✅ Após cada teste (sucesso ou falha)
- 📁 Organizados por nome do teste
- 🔗 Anexados automaticamente no Allure
- 🎯 Capturados em ações específicas via PageBase


// Uso no teste
cy.loginWith('usuario@teste.com', 'senha123');
```

## 🎯 Exemplos Práticos

### Cenário Completo com Allure
```javascript
import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';
import LoginPage from '../pages/loginPage';

const loginPage = new LoginPage();

Given("que eu estou na página de login do Kabum", () => {
  cy.allure().feature('Autenticação');
  cy.allure().story('Login de usuário');
  cy.allure().severity('critical');
  cy.allure().step('Navegando para a página de login');
  cy.visit('/');
});

When('eu preencho o campo de email com {string} e o campo de senha com {string}', (email, password) => {
  cy.allure().step('Fechando pop-up inicial');
  loginPage.clickPopUp();
  
  cy.allure().step(`Preenchendo email: ${email}`);
  cy.allure().parameter('Email', email);
  loginPage.fillEmailBase(email);
  
  cy.allure().step('Preenchendo senha');
  cy.allure().parameter('Password', '***');
  loginPage.fillPassword(password);
});

When('eu clico no botão de login', () => {
  cy.allure().step('Clicando no botão de login');
  loginPage.clickLoginButton();
});

Then('deve ser apresentada a mensagem de erro {string}', (text) => {
  cy.allure().step(`Verificando mensagem de erro: ${text}`);
  cy.allure().parameter('Mensagem esperada', text);
  loginPage.dadosInvalidosVisivelLogin(text);
});
```

## 📚 Recursos Adicionais

- [Documentação Cypress](https://docs.cypress.io/)
- [Cucumber.js](https://cucumber.io/docs/cucumber/)
- [Allure Report](https://docs.qameta.io/allure/)
- [Page Object Model](https://martinfowler.com/bliki/PageObject.html)
- [BDD com Gherkin](https://cucumber.io/docs/gherkin/)


♻️ Boas práticas
Use cy.intercept() para esperar requisições de rede (evite cy.wait(1000))
Crie comandos reutilizáveis no commands.js
Use fixtures para dados de entrada
Mantenha os testes pequenos e objetivos
Agrupe testes em arquivos por feature ou modulo

🧰 Ferramentas auxiliares
Cypress Studio (experimental): permite gravar ações pelo navegador
Mochawesome: relatórios de execução HTML
Allure: relatórios detalhados com histórico e screenshots
Cypress Dashboard: histórico e insights (para times integrados à nuvem)

🚀 Pipeline de execução (CI/CD)
