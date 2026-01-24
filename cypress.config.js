const { defineConfig } = require("cypress");
const createBundler = require("@bahmutov/cypress-esbuild-preprocessor");
const { addCucumberPreprocessorPlugin } = require("@badeball/cypress-cucumber-preprocessor");
const { createEsbuildPlugin } = require("@badeball/cypress-cucumber-preprocessor/esbuild");
const allureWriter = require('@shelex/cypress-allure-plugin/writer');
const { generatePdf } = require('./cypress/support/pdfHelper');
const fs = require('fs');
const path = require('path');

module.exports = defineConfig({
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    reporterEnabled: 'mocha-junit-reporter', 
    mochaJunitReporterReporterOptions: {
      mochaFile: 'cypress/results/results-[hash].xml'
    }
  },
  defaultCommandTimeout: 10000,
  e2e: {
    async setupNodeEvents(on, config) {
      const bundler = createBundler({
        plugins: [createEsbuildPlugin(config)],
      });
      on("file:preprocessor", bundler);
      await addCucumberPreprocessorPlugin(on, config);
      allureWriter(on, config);

      // --- ACUMULADOR DE EVIDÊNCIAS ---
      let evidences = [];

      on('task', {
        // Recebe os dados de CADA teste e guarda na memória
        accumulateEvidence(data) {
          console.log(`[Evidence] Recebido: ${data.title}`);
          evidences.push(data);
          return null;
        },
        
        // Tasks utilitárias (mantidas para compatibilidade)
        clearDownloads() { return null; },
        readExcelFile() { return null; },
        ensureDir() { return null; },
        generatePdfTask() { return null; } // Placeholder para não quebrar se alguém chamar
      });

      // --- GERA O PDF FINAL QUANDO TUDO ACABAR ---
      on('after:run', async () => {
        if (evidences.length > 0) {
          console.log('>>> GERANDO RELATÓRIO PDF FINAL <<<');
          const fileName = `cypress/evidence/Relatorio_Final_${Date.now()}.pdf`;
          
          // Garante pasta
          const dir = path.dirname(fileName);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

          try {
            await generatePdf(evidences, fileName);
            console.log(`PDF GERADO: ${fileName}`);
          } catch (err) {
            console.error('ERRO AO GERAR PDF:', err);
          }
        } else {
          console.log('Nenhuma evidência para gerar PDF.');
        }
      });

      return config;
    },

    env: {
      tags: "@teste", 
      allure: true,
      allureReuseAfterSpec: true,
      API_BASE_URL: "https://postman-echo.com"
    },
  }
});
