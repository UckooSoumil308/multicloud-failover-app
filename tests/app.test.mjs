import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Multi-Cloud Configuration & Infrastructure Tests', async (t) => {
  await t.test('1. Procfile exists and contains web: npm start for AWS Elastic Beanstalk', () => {
    const procfilePath = path.join(rootDir, 'Procfile');
    assert.ok(fs.existsSync(procfilePath), 'Procfile must exist in root directory');
    const content = fs.readFileSync(procfilePath, 'utf-8');
    assert.match(content, /^web:\s*npm start/m, 'Procfile must declare "web: npm start"');
  });

  await t.test('2. Dockerfile exists and configures multi-stage Node 20 container', () => {
    const dockerfilePath = path.join(rootDir, 'Dockerfile');
    assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile must exist');
    const content = fs.readFileSync(dockerfilePath, 'utf-8');
    assert.ok(content.includes('node:20-alpine'), 'Dockerfile must use node:20-alpine');
    assert.ok(content.includes('EXPOSE 8080'), 'Dockerfile must expose port 8080');
    assert.ok(content.includes('FROM'), 'Dockerfile must have multi-stage FROM instructions');
  });

  await t.test('3. .dockerignore exists and excludes node_modules and .next', () => {
    const dockerignorePath = path.join(rootDir, '.dockerignore');
    assert.ok(fs.existsSync(dockerignorePath), '.dockerignore must exist');
    const content = fs.readFileSync(dockerignorePath, 'utf-8');
    assert.ok(content.includes('node_modules'), '.dockerignore must exclude node_modules');
    assert.ok(content.includes('.next'), '.dockerignore must exclude .next');
  });

  await t.test('4. package.json contains required start script with ${PORT:-8080}', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    assert.ok(pkg.scripts?.start, 'package.json must have a "start" script');
    assert.ok(
      pkg.scripts.start.includes('${PORT:-8080}'),
      'start script must include ${PORT:-8080} for dual Azure F1 / AWS EB compatibility'
    );
    assert.ok(pkg.dependencies?.pg, 'package.json must include "pg" dependency');
  });

  await t.test('5. next.config.mjs exists and is configured for Next.js 14+', () => {
    const nextConfigPath = path.join(rootDir, 'next.config.mjs');
    assert.ok(fs.existsSync(nextConfigPath), 'next.config.mjs must exist');
    const content = fs.readFileSync(nextConfigPath, 'utf-8');
    assert.ok(content.includes('nextConfig'), 'next.config.mjs must declare nextConfig');
  });
});

test('Database Layer Fallback Tests (lib/db.js)', async (t) => {
  const dbModule = await import('../lib/db.js');

  await t.test('initDb initializes cleanly without DATABASE_URL', async () => {
    const result = await dbModule.initDb();
    assert.ok(result.initialized, 'initDb must succeed');
    assert.equal(result.engine, 'in-memory-fallback', 'Engine must fall back to in-memory');
  });

  await t.test('getIncidentLogs retrieves seeded records', async () => {
    const { records, engine } = await dbModule.getIncidentLogs(10);
    assert.ok(Array.isArray(records), 'records must be an array');
    assert.ok(records.length > 0, 'should contain seeded records');
    assert.equal(engine, 'in-memory-fallback');
  });

  await t.test('insertIncidentLog stores a new record', async () => {
    const testTitle = 'Automated Test Checkpoint';
    const { record, engine } = await dbModule.insertIncidentLog({
      title: testTitle,
      created_by_cloud: 'AZURE-PRIMARY',
      server_hostname: 'test-runner-host',
    });
    assert.ok(record.id, 'Inserted record must have an ID');
    assert.equal(record.title, testTitle);
    assert.equal(record.created_by_cloud, 'AZURE-PRIMARY');
    assert.equal(engine, 'in-memory-fallback');

    // Verify it is returned in subsequent fetch
    const { records } = await dbModule.getIncidentLogs(10);
    const found = records.find((r) => r.title === testTitle);
    assert.ok(found, 'Newly inserted record must be present in getIncidentLogs');
  });
});

test('Health Check API Route (/api/health)', async (t) => {
  const healthRoute = await import('../app/api/health/route.js');

  await t.test('GET /api/health initially returns 200 healthy status', async () => {
    global.isHealthy = true;
    const response = await healthRoute.GET();
    assert.equal(response.status, 200, 'HTTP status must be 200');
    const json = await response.json();
    assert.equal(json.status, 'healthy');
    assert.ok(json.cloud, 'Must include cloud metadata');
    assert.ok(json.hostname, 'Must include hostname');
    assert.ok(json.timestamp, 'Must include timestamp');
  });

  await t.test('POST /api/health toggles health to unhealthy (HTTP 503 trigger)', async () => {
    global.isHealthy = true;
    const toggleResponse = await healthRoute.POST();
    assert.equal(toggleResponse.status, 200);
    const toggleJson = await toggleResponse.json();
    assert.equal(toggleJson.isHealthy, false, 'isHealthy must now be false');
    assert.equal(toggleJson.status, 'unhealthy');

    // Subsequent GET should return 503
    const getResponse = await healthRoute.GET();
    assert.equal(getResponse.status, 503, 'GET must return HTTP 503 during simulated outage');
    const getJson = await getResponse.json();
    assert.equal(getJson.status, 'unhealthy');
    assert.ok(getJson.reason, 'Must contain simulated outage reason');
  });

  await t.test('POST /api/health restores health back to 200', async () => {
    global.isHealthy = false;
    const restoreResponse = await healthRoute.POST();
    assert.equal(restoreResponse.status, 200);
    const restoreJson = await restoreResponse.json();
    assert.equal(restoreJson.isHealthy, true, 'isHealthy must be restored to true');

    const getResponse = await healthRoute.GET();
    assert.equal(getResponse.status, 200, 'GET must return HTTP 200 after restoration');
  });
});

test('CRUD Records API Route (/api/records)', async (t) => {
  const recordsRoute = await import('../app/api/records/route.js');

  await t.test('GET /api/records returns records and server metadata', async () => {
    const response = await recordsRoute.GET();
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.ok(Array.isArray(json.records), 'records must be an array');
    assert.ok(json.cloud, 'Must return cloud');
    assert.ok(json.hostname, 'Must return hostname');
    assert.ok(typeof json.isHealthy === 'boolean', 'Must return isHealthy boolean');
  });

  await t.test('POST /api/records inserts record and returns HTTP 201', async () => {
    const mockRequest = {
      json: async () => ({ title: 'End-to-End API Test Event' }),
    };
    const response = await recordsRoute.POST(mockRequest);
    assert.equal(response.status, 201, 'POST must return HTTP 201');
    const json = await response.json();
    assert.equal(json.success, true);
    assert.equal(json.record.title, 'End-to-End API Test Event');
  });
});

