// publish-azure-testplans.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

function getEnv(name) {
  return process.env[name] || null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const map = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        map[key] = next;
        i++;
      } else {
        map[key] = 'true';
      }
    }
  }
  return map;
}

const ARGS = parseArgs();
const getConfigVar = (name) => ARGS[name] || getEnv(name);

// Configurações Obrigatórias
const AZURE_ORG = getConfigVar('AZURE_ORG');
const AZURE_PROJECT = getConfigVar('AZURE_PROJECT');
const AZURE_PAT = getConfigVar('AZURE_PAT');
const TEST_PLAN_ID = getConfigVar('AZURE_TEST_PLAN_ID');
const TEST_SUITE_ID = getConfigVar('AZURE_TEST_SUITE_ID');

if (!AZURE_ORG || !AZURE_PROJECT || !AZURE_PAT || !TEST_PLAN_ID || !TEST_SUITE_ID) {
  console.error('ERRO: Parâmetros obrigatórios ausentes.');
  console.error('Certifique-se de passar: ORG, PROJECT, PAT, TEST_PLAN_ID e TEST_SUITE_ID.');
  process.exit(1);
}

const junitDir = path.resolve('cypress', 'results');
const testCaseIdRegex = /ID:\s*(\d+)/;
const baseUrl = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/test`;
const apiVersion = '7.1';
const authHeader = 'Basic ' + Buffer.from(':' + AZURE_PAT).toString('base64');

const http = axios.create({
  headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
});

function outcomeFromTestcase(tc) {
  if (tc.failure) return 'Failed';
  if (tc.skipped) return 'NotExecuted';
  return 'Passed';
}

function aggregateOutcomes(dir) {
  if (!fs.existsSync(dir)) return new Map();
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xml')).map(f => path.join(dir, f));
  const parser = new XMLParser({ ignoreAttributes: false, allowBooleanAttributes: true });
  const caseOutcome = new Map();

  for (const file of files) {
    const xml = fs.readFileSync(file, 'utf-8');
    const doc = parser.parse(xml);
    let suites = [];

    if (doc.testsuites) {
      suites = Array.isArray(doc.testsuites.testsuite) ? doc.testsuites.testsuite : [doc.testsuites.testsuite];
    } else if (doc.testsuite) {
      suites = Array.isArray(doc.testsuite) ? doc.testsuite : [doc.testsuite];
    }

    for (const suite of suites.filter(Boolean)) {
      const testcases = Array.isArray(suite.testcase) ? suite.testcase : [suite.testcase];
      for (const tc of testcases.filter(Boolean)) {
        const name = tc['@_name'] || tc.name || '';
        const m = name.match(testCaseIdRegex);
        if (!m) continue;
        const caseId = parseInt(m[1], 10);
        const outcome = outcomeFromTestcase(tc);
        
        const prev = caseOutcome.get(caseId);
        const rank = { 'Failed': 3, 'Passed': 2, 'NotExecuted': 1 };
        if (!prev || rank[outcome] > rank[prev]) {
          caseOutcome.set(caseId, outcome);
        }
      }
    }
  }
  return caseOutcome;
}

(async function main() {
  try {
    console.log(`[Azure Test Plans] Iniciando publicação para Plan ${TEST_PLAN_ID}...`);
    const caseOutcome = aggregateOutcomes(junitDir);

    if (caseOutcome.size === 0) {
      console.log('Nenhum Test Case ID encontrado com padrão "ID: NNNN" nos XMLs.');
      return;
    }

    // 1. Obter Test Points
    const allPointIds = [];
    const resultsMap = [];

    for (const [caseId, outcome] of caseOutcome.entries()) {
      const url = `${baseUrl}/Plans/${TEST_PLAN_ID}/Suites/${TEST_SUITE_ID}/points?api-version=${apiVersion}&testCaseId=${caseId}`;
      const resp = await http.get(url);
      const points = resp.data.value || [];
      
      points.forEach(p => {
        allPointIds.push(p.id);
        resultsMap.push({ testCaseId: caseId, pointId: p.id, outcome });
      });
    }

    if (allPointIds.length === 0) {
      console.log('Nenhum Test Point encontrado para os IDs informados neste Plan/Suite.');
      return;
    }

    // 2. Criar Test Run
    const runBody = {
      name: `Cypress Automated Run - ${new Date().toISOString()}`,
      plan: { id: String(TEST_PLAN_ID) },
      pointIds: allPointIds,
      automated: true
    };
    const runResp = await http.post(`${baseUrl}/runs?api-version=${apiVersion}`, runBody);
    const runId = runResp.data.id;
    console.log(`Test Run criado: ${runId}`);

    // 3. Atualizar Resultados
    const runResultsResp = await http.get(`${baseUrl}/Runs/${runId}/results?api-version=${apiVersion}`);
    const azureResults = runResultsResp.data.value || [];

    const updatePayload = azureResults.map(res => {
      const match = resultsMap.find(m => m.testCaseId == res.testCase.id);
      return {
        id: res.id,
        outcome: match ? match.outcome : 'NotExecuted',
        state: 'Completed'
      };
    });

    await http.patch(`${baseUrl}/Runs/${runId}/results?api-version=${apiVersion}`, updatePayload);
    console.log(`Sucesso: ${updatePayload.length} resultados atualizados no Azure Test Plans.`);

  } catch (err) {
    console.error('Erro ao publicar resultados:', err.response?.data || err.message);
    process.exit(1);
  }
})();
