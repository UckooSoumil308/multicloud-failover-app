'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export default function MultiCloudDashboard() {
  const [healthData, setHealthData] = useState(null);
  const [healthStatus, setHealthStatus] = useState(200);
  const [records, setRecords] = useState([]);
  const [serverMeta, setServerMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [togglingHealth, setTogglingHealth] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch health status
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      setHealthStatus(res.status);
      const data = await res.json();
      setHealthData(data);
      return { status: res.status, data };
    } catch (err) {
      setHealthStatus(500);
      setHealthData({ status: 'unreachable', error: err.message });
      return { status: 500, data: null };
    }
  }, []);

  // Fetch records and metadata
  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/records', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setServerMeta({
          cloud: data.cloud,
          region: data.region,
          hostname: data.hostname,
          isHealthy: data.isHealthy,
          engine: data.engine,
        });
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch records:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Combined refresh
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchHealth(), fetchRecords()]);
  }, [fetchHealth, fetchRecords]);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Polling effect (every 3 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchHealth();
      fetchRecords();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealth, fetchRecords]);

  // Toggle Health (Simulate Outage / Restore)
  const handleToggleHealth = async () => {
    setTogglingHealth(true);
    try {
      const res = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      await refreshAll();

      if (data.isHealthy) {
        showNotification('Primary region health restored! Returning HTTP 200.', 'success');
      } else {
        showNotification('Simulated outage triggered! Now returning HTTP 503 Service Unavailable.', 'warning');
      }
    } catch (err) {
      showNotification('Failed to toggle health state: ' + err.message, 'error');
    } finally {
      setTogglingHealth(false);
    }
  };

  // Submit record
  const handleSubmitRecord = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewTitle('');
        showNotification(`Event logged successfully via ${serverMeta?.cloud || 'ACTIVE-NODE'}!`, 'success');
        await fetchRecords();
      } else {
        showNotification('Error writing record to database', 'error');
      }
    } catch (err) {
      showNotification('Error: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const activeCloud = serverMeta?.cloud || healthData?.cloud || 'LOCAL-DEV';
  const isAzure = activeCloud.toUpperCase().includes('AZURE');
  const isAws = activeCloud.toUpperCase().includes('AWS');
  const isOutage = healthStatus === 503 || serverMeta?.isHealthy === false || healthData?.status === 'unhealthy';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Notification Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-2xl border text-sm flex items-center gap-2 transition-all duration-300 ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : notification.type === 'warning'
              ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-current animate-ping" />
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Header Banner */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Multi-Cloud Control Tower</h1>
                <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  Zero-Cost Free Tier
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Active-Standby Automated Failover • Azure F1 Linux ↔ AWS Elastic Beanstalk Node 20
              </p>
            </div>
          </div>

          {/* Controls: Auto-refresh & Manual Refresh */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                autoRefresh
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/50'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>Auto-Refresh (3s): {autoRefresh ? 'ON' : 'PAUSED'}</span>
            </button>

            <button
              onClick={refreshAll}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center gap-1.5 transition-all"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* 1. Prominent Multi-Cloud Live Status Bar */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Active Serving Cloud */}
          <div
            className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
              isAzure
                ? 'bg-blue-950/40 border-blue-500/40 glow-azure'
                : isAws
                ? 'bg-amber-950/40 border-amber-500/40 glow-aws'
                : 'bg-slate-900/60 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-mono tracking-wider text-slate-400">Active Serving Cloud</span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isAzure ? 'bg-blue-400' : isAws ? 'bg-amber-400' : 'bg-cyan-400'
                }`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isAzure ? 'bg-blue-500' : isAws ? 'bg-amber-500' : 'bg-cyan-500'
                }`} />
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                  isAzure
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    : isAws
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                }`}
              >
                {isAzure ? 'AZ' : isAws ? 'AWS' : 'DEV'}
              </div>
              <div>
                <div
                  className={`text-xl font-black tracking-tight ${
                    isAzure ? 'text-blue-400' : isAws ? 'text-amber-400' : 'text-cyan-400'
                  }`}
                >
                  {activeCloud}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {isAzure ? 'Primary Target (App Service F1)' : isAws ? 'Failover Standby (Beanstalk)' : 'Local Host Development'}
                </div>
              </div>
            </div>
          </div>

          {/* Health Status & HTTP Code */}
          <div
            className={`p-5 rounded-2xl border transition-all duration-300 ${
              isOutage
                ? 'bg-rose-950/50 border-rose-500/60 glow-danger'
                : 'bg-emerald-950/30 border-emerald-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-mono tracking-wider text-slate-400">Endpoint Health State</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                isOutage ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {healthStatus} {isOutage ? 'OUTAGE' : 'OK'}
              </span>
            </div>
            <div className="text-2xl font-black tracking-tight flex items-center gap-2">
              {isOutage ? (
                <>
                  <span className="text-rose-400">HTTP 503</span>
                  <span className="text-xs px-2 py-0.5 bg-rose-900/60 text-rose-300 rounded font-normal">Unhealthy</span>
                </>
              ) : (
                <>
                  <span className="text-emerald-400">HTTP 200</span>
                  <span className="text-xs px-2 py-0.5 bg-emerald-900/60 text-emerald-300 rounded font-normal">Routing OK</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {isOutage ? 'Simulated Outage Active — Traffic reroutes to Standby' : 'Origin server responding normally'}
            </p>
          </div>

          {/* Hostname Node Info */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-mono tracking-wider text-slate-400">Serving Node</span>
              <span className="text-[10px] font-mono text-slate-500">os.hostname()</span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-200 truncate" title={serverMeta?.hostname || 'resolving...'}>
              {serverMeta?.hostname || 'node-local'}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Region: <strong className="text-slate-200">{serverMeta?.region || 'local'}</strong></span>
            </div>
          </div>

          {/* Database Layer Status */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-mono tracking-wider text-slate-400">PostgreSQL Layer</span>
              <span className="text-[10px] font-mono text-cyan-400">Neon / Supabase</span>
            </div>
            <div className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>{serverMeta?.engine === 'postgresql' ? 'Cloud PostgreSQL' : 'Resilient In-Memory'}</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {serverMeta?.engine === 'postgresql' ? 'SSL Active (rejectUnauthorized: false)' : 'Standalone fallback mode active'}
            </div>
          </div>
        </section>

        {/* 2. Interactive Outage Simulator Bar */}
        <section className="p-6 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900 to-slate-950 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-white">Live Failover Simulation & Health Trigger</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Clicking the trigger executes <code className="text-cyan-300 font-mono">POST /api/health</code> to flip the origin health check.
              When unhealthy (HTTP 503), cloud load balancers (Azure Traffic Manager, AWS Route 53, or Cloudflare Health Probes) automatically fail over to the secondary standby instance.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleToggleHealth}
              disabled={togglingHealth}
              className={`w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
                isOutage
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 ring-2 ring-emerald-400'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
              }`}
            >
              <svg className={`w-4 h-4 ${togglingHealth ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{isOutage ? 'Restore Origin Health (HTTP 200)' : 'Simulate Outage (Toggle HTTP 503)'}</span>
            </button>
          </div>
        </section>

        {/* 3. Dual-Cloud Architecture Topology Card */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Architecture Visualizer */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Multi-Cloud Routing Architecture</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              {/* Azure Card */}
              <div className={`p-4 rounded-xl border transition-all ${
                isAzure
                  ? 'bg-blue-950/50 border-blue-500/60 text-blue-200'
                  : 'bg-slate-950/40 border-slate-800 text-slate-400'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-blue-400">Azure App Service</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    PRIMARY
                  </span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div>Tier: <strong className="text-slate-200">Free F1 (Linux Node 20)</strong></div>
                  <div>Cost: <strong className="text-emerald-400">$0.00 / month</strong></div>
                  <div>Health Probe: <code className="text-cyan-300">/api/health</code></div>
                  <div>Status: <span className={isAzure ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{isAzure ? 'SERVING TRAFFIC' : 'STANDBY'}</span></div>
                </div>
              </div>

              {/* AWS Card */}
              <div className={`p-4 rounded-xl border transition-all ${
                isAws
                  ? 'bg-amber-950/50 border-amber-500/60 text-amber-200'
                  : 'bg-slate-950/40 border-slate-800 text-slate-400'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-amber-400">AWS Elastic Beanstalk</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    SECONDARY
                  </span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div>Tier: <strong className="text-slate-200">Free Tier (Single-Instance t3.micro)</strong></div>
                  <div>Cost: <strong className="text-emerald-400">$0.00 / month (750h free)</strong></div>
                  <div>Runtime: <code className="text-cyan-300">Procfile (web: npm start)</code></div>
                  <div>Status: <span className={isAws ? 'text-amber-400 font-bold' : 'text-slate-400'}>{isAws ? 'SERVING TRAFFIC' : 'STANDBY HOT-SPARE'}</span></div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Failover Strategy: <strong>DNS Health-Check Routing (HTTP 200 vs 503)</strong></span>
              <span className="text-slate-500 font-mono">Poll Interval: 3s</span>
            </div>
          </div>

          {/* Event Insertion Form */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Write Incident Log / Audit Record</span>
            </h3>

            <p className="text-xs text-slate-400">
              Submit a new record through the active serving origin. It tags the originating cloud provider and server hostname into PostgreSQL.
            </p>

            <form onSubmit={handleSubmitRecord} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Incident Title / Checkpoint Note
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Failover test conducted, simulated latency spiked..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-mono"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500 font-mono">
                  Origin Stamp: <strong className="text-cyan-400">{activeCloud}</strong>
                </span>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all flex items-center gap-2 shadow-lg shadow-cyan-600/20 disabled:opacity-50"
                >
                  <svg className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>{submitting ? 'Writing to DB...' : 'Commit Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* 4. Live Multi-Cloud Records Table */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Synchronized Incident Logs</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {records.length} records
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Shared PostgreSQL records ordered by <code className="text-slate-300">created_at DESC</code>
              </p>
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              Last Synced:{' '}
              <span className="text-slate-200">
                {lastRefreshed ? lastRefreshed.toLocaleTimeString() : 'connecting...'}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/50 font-mono text-slate-400">
                  <th className="py-3 px-4 w-16">ID</th>
                  <th className="py-3 px-4">Title / Event Summary</th>
                  <th className="py-3 px-4 w-44">Created By Cloud</th>
                  <th className="py-3 px-4 w-48">Origin Hostname</th>
                  <th className="py-3 px-4 w-48">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                      No incident logs found. Write the first checkpoint using the form above.
                    </td>
                  </tr>
                ) : (
                  records.map((rec) => {
                    const isAzureRecord = String(rec.created_by_cloud).toUpperCase().includes('AZURE');
                    const isAwsRecord = String(rec.created_by_cloud).toUpperCase().includes('AWS');

                    return (
                      <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-500">#{rec.id}</td>
                        <td className="py-3 px-4 font-medium text-slate-200">{rec.title}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold font-mono border ${
                              isAzureRecord
                                ? 'bg-blue-950/60 text-blue-300 border-blue-500/40'
                                : isAwsRecord
                                ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isAzureRecord ? 'bg-blue-400' : isAwsRecord ? 'bg-amber-400' : 'bg-cyan-400'
                              }`}
                            />
                            {rec.created_by_cloud}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px] truncate max-w-[12rem]">
                          {rec.server_hostname}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                          {new Date(rec.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500 font-mono">
        Multi-Cloud Resiliency Reference Architecture • Azure App Service F1 + AWS Elastic Beanstalk Single-Instance • Zero-Cost Free Tier Deployment
      </footer>
    </div>
  );
}

