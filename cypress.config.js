const { defineConfig } = require("cypress");
const createBundler = require("@bahmutov/cypress-esbuild-preprocessor");
const { addCucumberPreprocessorPlugin } = require("@badeball/cypress-cucumber-preprocessor");
const { createEsbuildPlugin } = require("@badeball/cypress-cucumber-preprocessor/esbuild");
const allureWriter = require('@shelex/cypress-allure-plugin/writer');


// ---------- Usando xlsx para mapear os arquivos em exel--------
const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');
// ---------------------------------------------------------------

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


        // --- ADICIONA AS TAREFAS NODE PARA O EXCEL/DOWNLOADS AQUI ---
      on('task', {
        clearDownloads() {
          console.log('Limpando a pasta de downloads...');
          const downloadsFolder = config.downloadsFolder;
          // Garante que a pasta exista antes de tentar ler
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

          // Pega o primeiro arquivo encontrado
          const filePath = path.join(downloadsFolder, excelFiles[0]); 
          console.log(`Lendo o arquivo: ${filePath}`);

          const workbook = xlsx.readFile(filePath);
          // Converte a primeira aba para JSON -- AQUI FAZEMOS A CONVERSAO
          const jsonData = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
          
          return jsonData;
        }
      });
      // ------------------------------------------------------------------



      return config;
    },

   env: {
    //variaveis que vão subir na pipe
   tags: "@teste", // Executar apenas os cenários com a tag 
   allure: true,
   allureReuseAfterSpec: true,
   
   API_BASE_URL: "https://postman-echo.com"
},
    

    specPattern: "cypress/e2e/**/**/*.feature", 
    supportFile: "cypress/support/e2e.js",
    baseUrl: "http://receivable-stg-merchants.ticket.edenred.net/",
    chromeWebSecurity: false,

    // Ajuste pra passar com historico do navegador
    modifyObstructiveCode: false,
    experimentalModifyObstructiveThirdPartyCode: true,
    //experimentalSessionAndOrigin: true, 
    
    
  },
});

