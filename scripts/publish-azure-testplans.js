'use strict';

// Simples e direto:
// - Lê JUnit XMLs em cypress/results
// - Extrai IDs dos casos a partir dos nomes (ex.: "ID: 286834")
// - Cria um único Test Run no Plan/Suite informados
// - Atualiza apenas Passed/Failed no Azure Test Plans

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

// Top-level config e helpers
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
function getConfigVar(name) {
  return ARGS[name] || getEnv(name);
}
function getFirstVar(names) {
  for (const n of names) {
    const v = getConfigVar(n);
    if (v !== undefined && v !== null && String(v).length > 0) return v;
  }
  return null;
}

const AZURE_ORG = getConfigVar('AZURE_ORG');
const AZURE_PROJECT = getConfigVar('AZURE_PROJECT');
const AZURE_PAT = getConfigVar('AZURE_PAT');

if (!AZURE_ORG || !AZURE_PROJECT || !AZURE_PAT) {
  throw new Error('Obrigatório informar AZURE_ORG, AZURE_PROJECT e AZURE_PAT (via env ou argumentos).');
}

const junitDir = path.resolve('cypress', 'results');
const testCaseIdRegex = /ID:\s*(\d+)/;

const baseUrl = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/test`;
const apiVersion = '7.1';

const authHeader = 'Basic ' + Buffer.from(':' + AZURE_PAT).toString('base64');

const http = axios.create({
  headers: {
    'Authorization': authHeader,
    'Content-Type': 'application/json'
  }
});

// Utilidades JUnit
function toArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function readAllJunitFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xml'));
  return files.map(f => path.join(dir, f));
}

// Extrai mapping caseId -> outcome (consolida: qualquer falha vence)
function aggregateOutcomes(files) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    allowBooleanAttributes: true
  });

  const caseOutcome = new Map(); // caseId -> 'Passed' | 'Failed'

  for (const file of files) {
    const xml = fs.readFileSync(file, 'utf-8');
    const doc = parser.parse(xml);

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
        if (!tc) continue;
        const name = tc['@_name'] || tc.name || '';
        const m = name.match(testCaseIdRegex);
        if (!m) continue;

        const caseId = parseInt(m[1], 10);
        const outcome = outcomeFromTestcase(tc);

        // Consolida: qualquer falha resulta em Failed
        const prev = caseOutcome.get(caseId);
        caseOutcome.set(caseId, prev === 'Failed' ? 'Failed' : outcome);
      }
    }
  }
  return caseOutcome;
}

// Azure DevOps Test APIs
// Busca test points para um Test Case ID dentro de um Plan/Suite específico
async function getPointsForCaseInSuite(planId, suiteId, caseId) {
  const url = `${baseUrl}/Plans/${planId}/Suites/${suiteId}/points?api-version=${apiVersion}&testCaseId=${caseId}`;
  const resp = await http.get(url);
  const points = Array.isArray(resp.data.value) ? resp.data.value : [];
  return points.map(p => p.id).filter(Boolean);
}

// Cria Test Run, opcionalmente associado a um Plan e a uma lista de pointIds
async function createTestRun(planId = null, pointIds = []) {
  const body = {
    name: `Cypress Automated - ${new Date().toISOString()}`,
    automated: true,
    state: 'InProgress'
  };
  if (planId) body.plan = { id: planId };
  if (Array.isArray(pointIds) && pointIds.length > 0) body.pointIds = pointIds;
  const url = `${baseUrl}/runs?api-version=${apiVersion}`;
  const resp = await http.post(url, body);
  return resp.data.id;
}

async function listRunResults(runId) {
  const url = `${baseUrl}/Runs/${runId}/results?api-version=${apiVersion}`;
  const resp = await http.get(url);
  return Array.isArray(resp.data.value) ? resp.data.value : [];
}

async function updateRunResults(runId, updates) {
  const url = `${baseUrl}/Runs/${runId}/results?api-version=${apiVersion}`;
  const resp = await http.patch(url, updates);
  return resp.data;
}

async function createRunResults(runId, caseOutcome) {
  const url = `${baseUrl}/Runs/${runId}/results?api-version=${apiVersion}`;
  const payload = [];

  for (const [caseId, outcome] of caseOutcome.entries()) {
    payload.push({
      testCase: { id: String(caseId) },
      automatedTestName: `Cypress Case ${caseId}`,
      outcome,              // 'Passed' | 'Failed'
      state: 'Completed',
      comment: 'Atualizado automaticamente (Passed/Failed) via Cypress/JUnit'
    });
  }

  const resp = await http.post(url, payload);
  return Array.isArray(resp.data.value) ? resp.data.value : resp.data;
}

async function completeRun(runId) {
  const url = `${baseUrl}/Runs/${runId}?api-version=${apiVersion}`;
  await http.patch(url, { state: 'Completed' });
}
(async function main() {
  try {
    console.log('[Publish TestPlans] Lendo XMLs em:', junitDir);
    const files = readAllJunitFiles(junitDir);
    if (files.length === 0) {
      console.log('[Publish TestPlans] Nenhum arquivo JUnit XML encontrado.');
      return;
    }

    const caseOutcome = aggregateOutcomes(files);
    if (caseOutcome.size === 0) {
      console.log('[Publish TestPlans] Nenhum Test Case ID encontrado nos nomes dos testes (esperado "ID: NNN").');
      return;
    }

    const TEST_PLAN_ID_RAW = getFirstVar(['TEST_PLAN_ID','AZURE_TEST_PLAN_ID','azure_test_plan_id']);
    const TEST_PLAN_ID = TEST_PLAN_ID_RAW ? parseInt(TEST_PLAN_ID_RAW, 10) : null;
    const TEST_SUITE_IDS_RAW = getFirstVar(['TEST_SUITE_IDS','TEST_SUITE_ID','AZURE_TEST_SUITE_IDS','AZURE_TEST_SUITE_ID','azure_test_suite_ids','azure_test_suite_id']);

    if (TEST_PLAN_ID && TEST_SUITE_IDS_RAW) {
      const suiteIds = String(TEST_SUITE_IDS_RAW)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(n => parseInt(n, 10))
        .filter(n => !Number.isNaN(n));

      console.log('[Publish TestPlans] Modo multi-suites no Plan:', TEST_PLAN_ID, 'Suites:', suiteIds.join(', '));

      // Agrega todos os test points para os caseIds encontrados, em todas as suites
      const pointIdSet = new Set();
      for (const suiteId of suiteIds) {
        for (const caseId of caseOutcome.keys()) {
          try {
            const points = await getPointsForCaseInSuite(TEST_PLAN_ID, suiteId, caseId);
            for (const pid of points) pointIdSet.add(pid);
          } catch (e) {
            console.warn(`[Publish TestPlans] Falha ao buscar points (plan=${TEST_PLAN_ID}, suite=${suiteId}, case=${caseId}):`, e.message);
          }
        }
      }
      const pointIds = Array.from(pointIdSet);

      if (pointIds.length === 0) {
        console.warn('[Publish TestPlans] Nenhum test point encontrado nas suites informadas. Publicando por testCase diretamente.');
        const runId = await createTestRun();
        console.log(`[Publish TestPlans] Test Run criado:`, runId);
        await createRunResults(runId, caseOutcome);
        await completeRun(runId);
        console.log('[Publish TestPlans] Resultados publicados com sucesso (Passed/Failed) por ID.');
      } else {
        // Cria o run associado ao plano e aos points das suites
        const runId = await createTestRun(TEST_PLAN_ID, pointIds);
        console.log(`[Publish TestPlans] Test Run criado (com pointIds):`, runId);

        // Obtem resultados iniciais (um por test point). Precisamos atualizar outcome por caseId
        const existing = await listRunResults(runId);

        // Mapeia por caseId para múltiplos resultados (duplicados entre suites são esperados)
        const updates = [];
        for (const res of existing) {
          const cid = res?.testCase?.id ? parseInt(res.testCase.id, 10) : null;
          if (!cid || Number.isNaN(cid)) continue;
          const desired = caseOutcome.get(cid);
          if (!desired) continue;
          updates.push({
            id: res.id,
            outcome: desired,
            state: 'Completed',
            comment: 'Atualizado automaticamente via Cypress/JUnit (multi-suites)'
          });
        }

        if (updates.length > 0) {
          await updateRunResults(runId, updates);
        } else {
          console.warn('[Publish TestPlans] Nenhum resultado para atualizar com base nos IDs encontrados.');
        }

        await completeRun(runId);
        console.log('[Publish TestPlans] Resultados atualizados com sucesso nas suites do plano.');
      }
    } else {
      // Fallback: cria um único Test Run sem plano/suite e publica por testCase
      const runId = await createTestRun();
      console.log(`[Publish TestPlans] Test Run criado:`, runId);
      await createRunResults(runId, caseOutcome);
      await completeRun(runId);
      console.log('[Publish TestPlans] Resultados publicados com sucesso (Passed/Failed) por ID.');
    }
  } catch (err) {
    console.error('[Publish TestPlans] Erro:', err.message);
    process.exitCode = 1;
  }
})();

// Conversão de testcase para outcome (simplificado: Passed/Failed)
function outcomeFromTestcase(tc) {
  if (tc.failure) return 'Failed';
  if (tc.error) return 'Failed';
  if (tc.skipped) return 'Failed';
  return 'Passed';
}
