const fs = require('fs');
const path = require('path');
const { generatePdf } = require('../cypress/support/pdfHelper');

const EVIDENCE_FILE = path.join(__dirname, '../cypress/evidence/temp_evidences.json');

async function run() {
  console.log('>>> INICIANDO GERAÇÃO MANUAL DE PDF <<<');

  if (!fs.existsSync(EVIDENCE_FILE)) {
    console.error('❌ Nenhuma evidência encontrada!');
    console.error('Certifique-se de ter rodado os testes pelo menos uma vez.');
    console.error(`Arquivo esperado: ${EVIDENCE_FILE}`);
    process.exit(1);
  }

  try {
    const evidences = JSON.parse(fs.readFileSync(EVIDENCE_FILE, 'utf-8'));
    
    if (!evidences || evidences.length === 0) {
      console.log('⚠️ Arquivo de evidências existe, mas está vazio.');
      return;
    }

    console.log(`📋 Encontradas ${evidences.length} evidências.`);

    const fileName = path.join(__dirname, `../cypress/evidence/Relatorio_Manual_${Date.now()}.pdf`);
    
    await generatePdf(evidences, fileName);
    
    console.log(`\n✅ PDF GERADO COM SUCESSO!`);
    console.log(`📂 Local: ${fileName}`);

  } catch (err) {
    console.error('❌ Erro ao ler/gerar PDF:', err);
  }
}

run();