Feature: Validar Nova solicitação

Background:
    Given que acesso o portal merchants hub Receivable

@teste
Scenario: CT1. Validar solicitação de extrato Simplificado em "Nova solicitação"
    When acessar menu 'Nova Solicitação'
    And seleciono tipo de extrato 'Simplificado'
    And preencho o campo Reembolso com o numero '132976563'
    And clico no botão Criar nova solicitação
    Then deve aparecer modal de sucesso

    #criar tabela? pra fazzer variações?, Clicar na flag de e-mail , e pensar também em quando for um filtro pro campo de inicio a data

Scenario: CT3. Validar Campos presentes ao selecionar tipo de extrato Simplificado em "Nova Solicitação"
    When acessar menu 'Nova Solicitação'
    And seleciono tipo de extrato 'Simplificado'
    Then deve conter os campos Contrato, Reembolso, Período, Número do Protocolo, Nome do Solicitante, Email do Solicitante


Scenario: CT4. Validar Campos presentes ao selecionar tipo de extrato Detalhado em "Nova Solicitação"
    When acessar menu 'Nova Solicitação'
    And seleciono tipo de extrato 'Detalhado' 
    Then deve conter os campos Contrato, Reembolso, CNPJ, Período, Número do Protocolo, Nome do Solicitante, Email do Solicitante

