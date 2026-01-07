// publish-azure-testplans.js (funções auxiliares global)
// Lê os XMLs JUnit do Cypress, extrai os IDs (ex.: "ID: 286834") do nome do teste,
// cria um Test Run no plano informado e atualiza os resultados dos pontos no Azure Test Plans.

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

// Top-level config e helpers
function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    return null;
  }
  return value;
}

// Suporte a argumentos de linha de comando: --AZURE_ORG, --AZURE_PROJECT, etc
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
function getConfigVar(name) {
  // Prioriza argumentos CLI e depois ENV
  return ARGS[name] || getEnv(name);
}

// Obrigatórios
const AZURE_ORG = getConfigVar('AZURE_ORG');
const AZURE_PROJECT = getConfigVar('AZURE_PROJECT');
const AZURE_PAT = getConfigVar('AZURE_PAT');
if (!AZURE_ORG || !AZURE_PROJECT || !AZURE_PAT) {
  throw new Error('AZURE_ORG, AZURE_PROJECT e AZURE_PAT são obrigatórios. Passe via ENV ou via argumentos: --AZURE_ORG --AZURE_PROJECT --AZURE_PAT');
}

// Opcionais (se ausentes, ativa descoberta automática)
const TEST_PLAN_ID = getConfigVar('AZURE_TEST_PLAN_ID') || null;
const TEST_SUITE_ID = getConfigVar('AZURE_TEST_SUITE_ID') || null;

const junitDir = path.resolve('cypress', 'results');
const testCaseIdRegex = /ID:\s*(\d+)/;

const baseUrl = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/test`;
const apiVersion = '7.1';

// Basic Auth com PAT (usuário vazio, PAT como senha)
const authHeader = 'Basic ' + Buffer.from(':' + AZURE_PAT).toString('base64');

const http = axios.create({
  headers: {
    'Authorization': authHeader,
    'Content-Type': 'application/json'
  }
});

// Converte nós de testcase em outcome
function outcomeFromTestcase(tc) {
  // Estrutura típica do fast-xml-parser:
  // tc = { "@_name": "nome", failure: {...}?, skipped: {...}? }
  if (tc.failure) return 'Failed';
  if (tc.skipped) return 'NotExecuted';
  return 'Passed';
}

// Busca todos XMLs na pasta cypress/results
function readAllJunitFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xml'));
  return files.map(f => path.join(dir, f));
}

// Extrai mapping caseId -> outcome mais severo
function aggregateOutcomes(files) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    allowBooleanAttributes: true
  });

  const caseOutcome = new Map(); // caseId -> outcome

  for (const file of files) {
    const xml = fs.readFileSync(file, 'utf-8');
    const doc = parser.parse(xml);

    // Estrutura pode ser testsuites/testsuites.testsuite[].testcase[]
    // ou testsuite/testsuite.testcase[]
    const suites = [];
    if (doc.testsuites) {
      const ts = Array.isArray(doc.testsuites.testsuite) ? doc.testsuites.testsuite : [doc.testsuites.testsuite].filter(Boolean);
      suites.push(...ts.filter(Boolean));
    } else if (doc.testsuite) {
      const ts = Array.isArray(doc.testsuite) ? doc.testsuite : [doc.testsuite].filter(Boolean);
      suites.push(...ts.filter(Boolean));
    }

    for (const suite of suites) {
      const testcases = Array.isArray(suite.testcase) ? suite.testcase : [suite.testcase].filter(Boolean);
      for (const tc of testcases) {
        const name = tc['@_name'] || tc.name || '';
        const m = name.match(testCaseIdRegex);
        if (!m) continue; // só considera casos com "ID: NNNNN"
        const caseId = parseInt(m[1], 10);
        const outcome = outcomeFromTestcase(tc);

        // Consolida o pior resultado (Failed > Passed > NotExecuted)
        const prev = caseOutcome.get(caseId);
        if (!prev) {
          caseOutcome.set(caseId, outcome);
        } else {
          const rank = { 'Failed': 3, 'Passed': 2, 'NotExecuted': 1 };
          caseOutcome.set(caseId, rank[outcome] >= rank[prev] ? outcome : prev);
        }
      }
    }
  }
  return caseOutcome;
}

// Busca test points para um Test Case ID
async function getPointIdsForCase(caseId) {
  const url = `${baseUrl}/Plans/${TEST_PLAN_ID}/Suites/${TEST_SUITE_ID}/points?api-version=${apiVersion}&testCaseId=${caseId}&$top=200`;
  const resp = await http.get(url);
  const points = Array.isArray(resp.data.value) ? resp.data.value : [];
  return points.map(p => p.id).filter(Boolean);
}

// Cria um Test Run com os pointIds
// createTestRun com planId explícito
async function createTestRun(pointIds, planId) {
  const body = {
    name: `Cypress Automated - ${new Date().toISOString()}`,
    plan: { id: String(planId) },
    pointIds: pointIds,
    automated: true
  };
  const url = `${baseUrl}/runs?api-version=${apiVersion}`;
  const resp = await http.post(url, body);
  return resp.data.id;
}

// Lista resultados criados automaticamente no run
async function listRunResults(runId) {
  const url = `${baseUrl}/Runs/${runId}/results?api-version=${apiVersion}`;
  const resp = await http.get(url);
  return Array.isArray(resp.data.value) ? resp.data.value : [];
}

// Atualiza resultados no run
async function updateRunResults(runId, updates) {
  const url = `${baseUrl}/Runs/${runId}/results?api-version=${apiVersion}`;
  const resp = await http.patch(url, updates);
  return resp.data;
}

// Lista todos os Test Plans do projeto
async function listTestPlans() {
  const url = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/testplan/plans?includePlanDetails=true&api-version=${apiVersion}`;
  const resp = await http.get(url);
  return Array.isArray(resp.data.value) ? resp.data.value : [];
}

async function listSuitesForPlan(planId) {
  const url = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/test/Plans/${planId}/suites?api-version=${apiVersion}`;
  const resp = await http.get(url);
  return Array.isArray(resp.data.value) ? resp.data.value : [];
}

async function getPointsForCaseInSuite(planId, suiteId, caseId) {
  const url = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/test/Plans/${planId}/Suites/${suiteId}/points?testCaseId=${caseId}&api-version=${apiVersion}`;
  const resp = await http.get(url);
  const points = Array.isArray(resp.data.value) ? resp.data.value : [];
  return points.map(p => p.id).filter(Boolean);
}

// publish-azure-testplans.js (bloco principal dentro de main)
// Fluxo principal (descoberta automática por padrão)
(async function main() {
  try {
    console.log('[Publish TestPlans] Lendo XMLs em:', junitDir);
    const files = readAllJunitFiles(junitDir);
    if (files.length === 0) {
      console.log('[Publish TestPlans] Nenhum arquivo JUnit XML encontrado. Finalizando.');
      return;
    }

    const caseOutcome = aggregateOutcomes(files);
    if (caseOutcome.size === 0) {
      console.log('[Publish TestPlans] Nenhum Test Case ID encontrado nos nomes dos testes (esperado "ID: NNN").');
      return;
    }

    // Se plan/suite forem informados, usa modo específico
    if (TEST_PLAN_ID && TEST_SUITE_ID) {
      const allPointIds = new Set();
      for (const [caseId] of caseOutcome.entries()) {
        const url = `${baseUrl}/Plans/${TEST_PLAN_ID}/Suites/${TEST_SUITE_ID}/points?api-version=${apiVersion}&testCaseId=${caseId}&$top=200`;
        const resp = await http.get(url);
        const points = Array.isArray(resp.data.value) ? resp.data.value : [];
        points.forEach(p => allPointIds.add(p.id));
      }
      if (allPointIds.size === 0) {
        console.log('[Publish TestPlans] Não há pointIds para criar o run. Verifique Plan/Suite/Case IDs.');
        return;
      }
      const runId = await createTestRun(Array.from(allPointIds), TEST_PLAN_ID);
      console.log('[Publish TestPlans] Test Run criado:', runId);

      const results = await listRunResults(runId);
      const updates = [];
      for (const result of results) {
        const tc = result.testCase;
        const caseId = tc && (tc.id || tc.workItem?.id || tc['webUrl']?.match(/id=(\d+)/)?.[1]);
        const numericCaseId = caseId ? parseInt(caseId, 10) : NaN;
        if (!numericCaseId || !caseOutcome.has(numericCaseId)) continue;
        const desired = caseOutcome.get(numericCaseId);
        updates.push({ id: result.id, state: 'Completed', outcome: desired, comment: 'Atualizado automaticamente via Cypress/JUnit pela pipeline' });
      }
      if (updates.length > 0) {
        await updateRunResults(runId, updates);
        console.log('[Publish TestPlans] Resultados atualizados com sucesso no Test Plans.');
      } else {
        console.warn('[Publish TestPlans] Nenhum resultado para atualizar.');
      }
      return;
    }

    // Descoberta automática: varre todos os planos/suites e agrupa pointIds por plano
    const plans = await listTestPlans();
    const planToPoints = new Map(); // planId -> Set(pointId)

    for (const plan of plans) {
      const suites = await listSuitesForPlan(plan.id);
      for (const [caseId] of caseOutcome.entries()) {
        for (const suite of suites) {
          const points = await getPointsForCaseInSuite(plan.id, suite.id, caseId);
          if (points.length > 0) {
            if (!planToPoints.has(plan.id)) planToPoints.set(plan.id, new Set());
            points.forEach(p => planToPoints.get(plan.id).add(p));
          }
        }
      }
    }

    if (planToPoints.size === 0) {
      console.log('[Publish TestPlans] Não foram encontrados Test Points para os IDs informados em nenhum Test Plan/Suite.');
      return;
    }

    // Cria um run por plano e atualiza resultados
    for (const [planId, pointsSet] of planToPoints.entries()) {
      const pointIds = Array.from(pointsSet);
      const runId = await createTestRun(pointIds, planId);
      console.log(`[Publish TestPlans] Test Run criado no plan ${planId}:`, runId);

      const results = await listRunResults(runId);
      const updates = [];

      for (const result of results) {
        const tc = result.testCase;
        const caseId = tc && (tc.id || tc.workItem?.id || tc['webUrl']?.match(/id=(\d+)/)?.[1]);
        const numericCaseId = caseId ? parseInt(caseId, 10) : NaN;
        if (!numericCaseId || !caseOutcome.has(numericCaseId)) continue;

        const desired = caseOutcome.get(numericCaseId);
        updates.push({
          id: result.id,
          state: 'Completed',
          outcome: desired,
          comment: 'Atualizado automaticamente via Cypress/JUnit pela pipeline'
        });
      }

      if (updates.length > 0) {
        await updateRunResults(runId, updates);
        console.log(`[Publish TestPlans] Resultados atualizados com sucesso no plan ${planId}.`);
      } else {
        console.warn(`[Publish TestPlans] Nenhum resultado para atualizar no plan ${planId}.`);
      }
    }
  } catch (err) {
    console.error('[Publish TestPlans] Erro:', err.message);
    process.exitCode = 1;
  }
})();