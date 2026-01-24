const { defineConfig } = require("cypress");
const createBundler = require("@bahmutov/cypress-esbuild-preprocessor");
const { addCucumberPreprocessorPlugin } = require("@badeball/cypress-cucumber-preprocessor");
const { createEsbuildPlugin } = require("@badeball/cypress-cucumber-preprocessor/esbuild");
const allureWriter = require('@shelex/cypress-allure-plugin/writer');

// ---------- Imports para PDF e Excel --------
const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');
// --- PDF: Import do helper simplificado ---
const { generatePdf } = require('./cypress/support/pdfHelper'); 
// --------------------------------

module.exports = defineConfig({
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    reporterEnabled: 'mocha-junit-reporter', 
    mochaJunitReporterReporterOptions: {
      mochaFile: 'cypress/results/results-[hash].xml',
      useTestAttributesForTestCaseIds: true,
      testCaseIdAttributeName: "testcaseid",
      testCaseIdRegex: /ID:\s*(\d+)/ 
    }
  },
  defaultCommandTimeout: 10000,
  e2e: {
    async setupNodeEvents(on, config) {
      // ✅ configura o preprocessor
      const bundler = createBundler({
        plugins: [createEsbuildPlugin(config)],
      });
      on("file:preprocessor", bundler);

      // ✅ ativa cucumber
      await addCucumberPreprocessorPlugin(on, config);

      // ✅ ativa allure
      allureWriter(on, config);

      // --- ACUMULADOR DE EVIDÊNCIAS ---
      let evidences = [];

      // --- ADICIONA AS TAREFAS (Tasks) ---
      on('task', {
        // --- PDF ACUMULADOR ---
        accumulateEvidence(data) {
          console.log(`[Evidence] Recebido: ${data.title}`);
          evidences.push(data);
          return null;
        },
        // Mantido para compatibilidade caso ainda seja chamado, mas não faz nada
        generatePdfTask() { return null; },

        // --- TASKS ORIGINAIS ---
        clearDownloads() {
          console.log('Limpando a pasta de downloads...');
          const downloadsFolder = config.downloadsFolder;
          if (fs.existsSync(downloadsFolder)) {
              fs.readdirSync(downloadsFolder).forEach(file => {
                const filePath = path.join(downloadsFolder, file);
                fs.unlinkSync(filePath);
              });
          }
          return null;
        },
        readExcelFile() {
          const downloadsFolder = config.downloadsFolder;
          const files = fs.readdirSync(downloadsFolder);
          const excelFiles = files.filter(file => file.endsWith('.xlsx') || file.endsWith('.xls'));

          if (excelFiles.length === 0) {
            throw new Error("Nenhum arquivo Excel encontrado na pasta de downloads.");
          }

          const filePath = path.join(downloadsFolder, excelFiles[0]); 
          console.log(`Lendo o arquivo: ${filePath}`);

          const workbook = xlsx.readFile(filePath);
          const jsonData = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
          
          return jsonData;
        },
        ensureDir(dir) {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          return null;
        }
      });

      // --- GERA O PDF FINAL QUANDO TUDO ACABAR ---
      on('after:run', async () => {
        if (evidences.length > 0) {
          console.log('>>> GERANDO RELATÓRIO PDF FINAL <<<');
          const fileName = `cypress/evidence/Relatorio_Final_${Date.now()}.pdf`;
          
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
    //variaveis que vão subir na pipe
   tags: "@teste", 
   allure: true,
   allureReuseAfterSpec: true,
   API_BASE_URL: "https://postman-echo.com"
   },
 }
});
