import { NextResponse } from 'next/server.js';
import os from 'os';
import { initDb, getIncidentLogs, insertIncidentLog } from '../../../lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await initDb();
    const result = await getIncidentLogs(20);

    const cloud = process.env.CLOUD_PROVIDER || 'LOCAL-DEV';
    const region = process.env.CLOUD_REGION || 'local';
    const hostname = os.hostname();
    const isHealthy = typeof global.isHealthy === 'undefined' ? true : global.isHealthy !== false;

    return NextResponse.json(
      {
        records: result.records,
        cloud,
        region,
        hostname,
        isHealthy,
        engine: result.engine,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('GET /api/records error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve records',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty or not json
    }

    const title = (body?.title && String(body.title).trim()) || 'Manual failover checkpoint event';
    const created_by_cloud = process.env.CLOUD_PROVIDER || 'LOCAL';
    const server_hostname = os.hostname();

    await initDb();
    const result = await insertIncidentLog({
      title,
      created_by_cloud,
      server_hostname,
    });

    return NextResponse.json(
      {
        success: true,
        record: result.record,
        engine: result.engine,
        timestamp: new Date().toISOString(),
      },
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('POST /api/records error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create record',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
