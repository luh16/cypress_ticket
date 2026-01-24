const { defineConfig } = require("cypress");
const createBundler = require("@bahmutov/cypress-esbuild-preprocessor");
const { addCucumberPreprocessorPlugin } = require("@badeball/cypress-cucumber-preprocessor");
const { createEsbuildPlugin } = require("@badeball/cypress-cucumber-preprocessor/esbuild");
const allureWriter = require('@shelex/cypress-allure-plugin/writer');

// ---------- Imports para PDF e Excel --------
const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');
// --- PDF: COPIAR ESTE REQUIRE ---
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

      // --- ADICIONA AS TAREFAS (Tasks) ---
      on('task', {
        // --- PDF: COPIAR ESTA TASK ---
        generatePdfTask(options) {
            console.log('TASK generatePdfTask CHAMADA:', options.outputFile);
            try {
                const dir = path.dirname(options.outputFile);
                if (!fs.existsSync(dir)) {
                    console.log('Criando diretório:', dir);
                    fs.mkdirSync(dir, { recursive: true });
                }
                generatePdf(options);
                console.log('PDF gerado com sucesso via task.');
            } catch (err) {
                console.error('ERRO AO GERAR PDF NA TASK:', err);
            }
            return null;
        },
        // -----------------------------

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
      // ------------------------------------------------------------------

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
