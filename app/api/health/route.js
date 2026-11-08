import { NextResponse } from 'next/server.js';
import os from 'os';

export const dynamic = 'force-dynamic';

// Maintain global health state across requests
if (typeof global.isHealthy === 'undefined') {
  global.isHealthy = true;
}

export async function GET() {
  const isHealthy = global.isHealthy !== false;
  const cloud = process.env.CLOUD_PROVIDER || 'LOCAL-DEV';
  const region = process.env.CLOUD_REGION || 'local';
  const hostname = os.hostname();
  const timestamp = new Date().toISOString();

  if (isHealthy) {
    return NextResponse.json(
      {
        status: 'healthy',
        cloud,
        region,
        hostname,
        timestamp,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }

  return NextResponse.json(
    {
      status: 'unhealthy',
      cloud,
      reason: 'Simulated primary region outage for failover verification',
      timestamp,
      hostname,
    },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

export async function POST() {
  global.isHealthy = !(global.isHealthy !== false);
  const isHealthy = global.isHealthy;
  const cloud = process.env.CLOUD_PROVIDER || 'LOCAL-DEV';
  const hostname = os.hostname();

  return NextResponse.json(
    {
      isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      cloud,
      hostname,
      message: isHealthy
        ? 'Cluster health restored: Routing enabled (HTTP 200)'
        : 'Simulated outage initiated: Failover trigger active (HTTP 503)',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
