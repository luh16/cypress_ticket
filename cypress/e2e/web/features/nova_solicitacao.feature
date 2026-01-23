Feature: Validar Nova solicitação

Background:
    Given que acesso o portal merchants hub Receivable

@teste
Scenario: CT1. Validar solicitação de extrato Simplificado em "Nova solicitação" ID: 286834
    When acessar menu 'Nova Solicitação'
    #And seleciono tipo de extrato 'Simplificado'
    #And preencho o campo Reembolso com o numero '132976563'
    #And gero nova solicitação com os dados do solicitante repassando o email
    #Then deve aparecer modal de sucesso

    

Scenario: CT3. Validar Campos presentes ao selecionar tipo de extrato Simplificado em "Nova Solicitação"
    When acessar menu 'Nova Solicitação'
    And seleciono tipo de extrato 'Simplificado'
    Then deve conter os campos Contrato, Reembolso, Período, Número do Protocolo, Nome do Solicitante, Email do Solicitante


Scenario: CT4. Validar Campos presentes ao selecionar tipo de extrato Detalhado em "Nova Solicitação"
    When acessar menu 'Nova Solicitação'
    And seleciono tipo de extrato 'Detalhado' 
    Then deve conter os campos Contrato, Reembolso, CNPJ, Período, Número do Protocolo, Nome do Solicitante, Email do Solicitante


#fazer cenario completo? usando outros steps? somente quando for excel
Scenario: CT51. Validar que o campo 'Contrato' presente no documento Excel seja igual ao contrato do Grid da busca 'Detalhada'  em 'Histórico de Solicitações'
