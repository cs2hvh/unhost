"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LineChart from "@/components/ui/line-chart";
import { createClient } from "@/lib/supabase/client";
import { FaPlay, FaRedo, FaPowerOff, FaCopy, FaMicrochip, FaMemory, FaHdd, FaThumbsUp, FaSync, FaTrash } from "react-icons/fa";
import Image from "next/image";
import { getFlagUrl } from "@/lib/linode";

type MetricsPoint = { t: number; cpu: number | null; memUsed: number | null; netIn: number | null; netOut: number | null };
type RangeKey = "hour" | "day" | "week";
type LocationOption = { id: string; name?: string; location?: string };

export default function VmMonitorPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [server, setServer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<null | "start" | "reboot" | "stop">(null);
  const [confirmAction, setConfirmAction] = useState<null | "reboot" | "stop" | "rebuild">(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [rebuildConfirmName, setRebuildConfirmName] = useState("");
  const [rebuildUnderstand, setRebuildUnderstand] = useState(false);

  const loadServer = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from("servers").select("*").eq("id", id).maybeSingle();
    if (!error) setServer(data);
  }, [id]);

  const syncServerStatus = useCallback(async () => {
    if (!server?.id) return;
    setSyncing(true);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch("/api/linode/instances/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ serverId: server.id }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        await loadServer();
      }
    } catch (err) {
      console.error('Failed to sync server status:', err);
    } finally {
      setSyncing(false);
    }
  }, [server?.id, loadServer]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/linode/options", { cache: "no-store" });
      const json = await res.json();
      setLocations(json.regions || []);
    } catch {}
  }, []);

  // Per-chart ranges and metrics
  const [cpuRange, setCpuRange] = useState<RangeKey>("hour");
  const [ramRange, setRamRange] = useState<RangeKey>("hour");
  const [netRange, setNetRange] = useState<RangeKey>("hour");

  const useMetrics = (range: RangeKey) => {
    const [series, setSeries] = useState<MetricsPoint[]>([]);
    const [metricsLoading, setMetricsLoading] = useState(true);
    const [metricsError, setMetricsError] = useState<string | null>(null);

    const load = useCallback(async () => {
      try {
        setMetricsLoading(true);
        setMetricsError(null);
        const supabase = createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const res = await fetch(`/api/linode/instances/metrics?serverId=${encodeURIComponent(id)}&range=${range}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        const json = await res.json();
        if (res.ok && json.ok) {
          setSeries(json.series || []);
        } else {
          // Check if it's the "stats unavailable" error
          const errorMsg = json.error || 'Failed to load metrics';
          if (errorMsg.includes('unavailable') || errorMsg.includes('after some time')) {
            setMetricsError('Metrics will be available shortly');
          } else {
            setMetricsError(errorMsg);
          }
          setSeries([]);
        }
      } catch (err: any) {
        setMetricsError(err?.message || 'Failed to load metrics');
        setSeries([]);
      } finally {
        setMetricsLoading(false);
      }
    }, [range]);

    useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load]);
    return { series, loading: metricsLoading, error: metricsError };
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadServer(), loadLocations()]).finally(()=>setLoading(false));
  }, [loadServer, loadLocations]);

  // Auto-sync status every 10 seconds if status is provisioning or rebuilding
  useEffect(() => {
    if (server?.status === 'provisioning' || server?.status === 'rebuilding') {
      const interval = setInterval(() => {
        syncServerStatus();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [server?.status, syncServerStatus]);

  const cpuMetrics = useMetrics(cpuRange);
  const ramMetrics = useMetrics(ramRange);
  const netMetrics = useMetrics(netRange);

  const cpuSeries = useMemo(() => cpuMetrics.series.map((p: MetricsPoint) => ({ x: p.t * 1000, y: p.cpu ?? null })), [cpuMetrics.series]);
  const ramSeries = useMemo(() => ramMetrics.series.map((p: MetricsPoint) => ({ x: p.t * 1000, y: p.memUsed ?? null })), [ramMetrics.series]);
  const netInSeries = useMemo(() => netMetrics.series.map((p: MetricsPoint) => ({ x: p.t * 1000, y: p.netIn ?? null })), [netMetrics.series]);
  const netOutSeries = useMemo(() => netMetrics.series.map((p: MetricsPoint) => ({ x: p.t * 1000, y: p.netOut ?? null })), [netMetrics.series]);

  const maxOf = (arr: (number | null)[]) => {
    const vals = arr.filter((v): v is number => typeof v === "number" && isFinite(v));
    return vals.length ? Math.max(...vals) : 1;
  };
  const netMax = Math.max(maxOf(netInSeries.map(p=>p.y)), maxOf(netOutSeries.map(p=>p.y)));
  const fmtBytes = (v: number) => {
    if (v < 1024) return `${Math.round(v)} B/s`;
    if (v < 1024*1024) return `${(v/1024).toFixed(1)} KB/s`;
    if (v < 1024*1024*1024) return `${(v/1024/1024).toFixed(2)} MB/s`;
    return `${(v/1024/1024/1024).toFixed(2)} GB/s`;
  };

  // Region details for header
  const regionObj = useMemo(() => {
    const locId = String(server?.location || "");
    return locations.find((l) => String(l.id) === locId);
  }, [locations, server?.location]);
  const regionName = useMemo(() => {
    return ((regionObj as any)?.country || regionObj?.name || regionObj?.id || server?.location || "");
  }, [regionObj, server?.location]);
  const regionFlagUrl = useMemo(() => {
    return ((regionObj as any)?.flagUrl || getFlagUrl((regionObj as any)?.countryCode || 'XX'));
  }, [regionObj]);
  const regionCountryCode = useMemo(() => {
    return ((regionObj as any)?.countryCode || 'XX');
  }, [regionObj]);

  const powerAction = async (action: "start" | "reboot" | "stop") => {
    if (!server?.id) return;
    setActing(action);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch("/api/linode/instances/power", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ serverId: server.id, action }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Action failed");
      await loadServer();
    } catch {}
    finally { setActing(null); }
  };

  const rebuildInstance = async () => {
    if (!server?.id) return;
    setActing("stop"); // Use stop as placeholder for rebuild
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch("/api/linode/instances/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ serverId: server.id, image: server.os }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Rebuild failed");
      setConfirmAction(null);
      setRebuildConfirmName("");
      setRebuildUnderstand(false);
      await loadServer();
    } catch (err: any) {
      console.error('Rebuild error:', err);
      const errorMsg = err.message || 'Failed to rebuild instance';
      if (errorMsg.includes('SSH key')) {
        alert('⚠️ ' + errorMsg + '\n\nPlease go to Settings → Security to add SSH keys.');
      } else {
        alert('Failed to rebuild instance: ' + errorMsg);
      }
    }
    finally { setActing(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-white flex items-center gap-3">
            <span className="truncate max-w-[60vw]">{server?.name || "Server"}</span>
            <span className="inline-flex items-center gap-2 text-sm text-white/70">
              <Image src={regionFlagUrl} alt={regionName} width={24} height={24} className="rounded" />
              <span className="truncate max-w-[40vw]">{regionName || "Region"}</span>
            </span>
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-white/60 text-sm">IP: {server?.ip || "—"}</p>
            {server?.ip && (
              <Button
                onClick={async()=>{ await navigator.clipboard.writeText(server.ip); }}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-white/60 hover:text-white"
                title="Copy IP"
              >
                <FaCopy className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/servers?view=list"><Button className="bg-white/10 text-white border border-white/10 hover:bg-white/20">Back to My Servers</Button></Link>
        </div>
      </div>

      {loading ? (<div className="text-white/60">Loading...</div>) : (
        <>
          {/* Details & actions */}
          <Card className="bg-black/50 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">{server?.name || 'VM'}</CardTitle>
              <CardDescription className="text-white/60">
                IP: {server?.ip || '—'} • Status: {' '}
                <span className={`inline-flex items-center gap-1 ${
                  server?.status === 'running' ? 'text-green-400' :
                  server?.status === 'provisioning' || server?.status === 'rebuilding' ? 'text-yellow-400' :
                  server?.status === 'offline' ? 'text-red-400' :
                  'text-white/60'
                }`}>
                  {server?.status || '—'}
                  {(server?.status === 'provisioning' || server?.status === 'rebuilding') && <FaSync className="animate-spin text-xs" />}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-white/5 border border-white/10">
                  <FaMicrochip className="text-white/60" />
                  <span>{server?.cpu_cores || '?'} vCPU</span>
                </span>
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-white/5 border border-white/10">
                  <FaMemory className="text-white/60" />
                  <span>{server?.memory_mb || 0} MB</span>
                </span>
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-white/5 border border-white/10">
                  <FaHdd className="text-white/60" />
                  <span>{server?.disk_gb ? `${server.disk_gb} GB` : '—'}</span>
                </span>
              </div>
              <div className="grow" />
              {String(server?.status || '').toLowerCase() === 'stopped' ? (
                <Button onClick={() => powerAction('start')} disabled={acting==='start'} className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 cursor-pointer"><FaPlay className="mr-2" /> Start</Button>
              ) : (
                <>
                  <Button onClick={() => setConfirmAction('reboot')} disabled={acting==='reboot'} className="group bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 border border-yellow-500/40 cursor-pointer">
                    <span className="relative w-4 h-4 mr-2 inline-block">
                      <FaRedo className="absolute inset-0 transition-opacity duration-150 group-hover:opacity-0" />
                      <FaThumbsUp className="absolute inset-0 transition-opacity duration-150 opacity-0 group-hover:opacity-100" />
                    </span>
                    Reboot
                  </Button>
                  <Button onClick={() => setConfirmAction('stop')} disabled={acting==='stop'} className="group bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 cursor-pointer">
                    <span className="relative w-4 h-4 mr-2 inline-block">
                      <FaPowerOff className="absolute inset-0 transition-opacity duration-150 group-hover:opacity-0" />
                      <FaThumbsUp className="absolute inset-0 transition-opacity duration-150 opacity-0 group-hover:opacity-100" />
                    </span>
                    Power Off
                  </Button>
                </>
              )}
              <Button onClick={() => setConfirmAction('rebuild')} className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-500/40 cursor-pointer">
                <FaTrash className="mr-2" /> Reset/Rebuild
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-black/50 border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-white">CPU Usage</CardTitle>
                    <CardDescription className="text-white/60">Percent over time</CardDescription>
                  </div>
                  <select className="bg-black border border-white/10 text-white rounded px-2 py-1 text-sm"
                          value={cpuRange} onChange={(e)=>setCpuRange(e.target.value as RangeKey)}>
                    <option value="hour">Last hour</option>
                    <option value="day">Last day</option>
                    <option value="week">Last week</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {cpuMetrics.loading ? (
                  <div className="flex items-center justify-center h-[280px] text-white/40">Loading metrics...</div>
                ) : cpuMetrics.error ? (
                  <div className="flex items-center justify-center h-[280px] text-red-400 text-sm">{cpuMetrics.error}</div>
                ) : cpuSeries.length === 0 ? (
                  <div className="flex items-center justify-center h-[280px] text-white/40 text-sm">No data available</div>
                ) : (
                  <LineChart data={cpuSeries} width={700} height={280} color="#60A5FA" yMin={0} yMax={100} yPercent={true} />
                )}
              </CardContent>
            </Card>

            <Card className="bg-black/50 border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-white">RAM Usage</CardTitle>
                    <CardDescription className="text-white/60">Memory metrics not available via Linode API</CardDescription>
                  </div>
                  <select className="bg-black border border-white/10 text-white rounded px-2 py-1 text-sm"
                          value={ramRange} onChange={(e)=>setRamRange(e.target.value as RangeKey)}>
                    <option value="hour">Last hour</option>
                    <option value="day">Last day</option>
                    <option value="week">Last week</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-[280px] text-white/40 text-sm">
                  Memory metrics require in-server monitoring (e.g., install monitoring agent)
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/50 border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-white">Network In</CardTitle>
                    <CardDescription className="text-white/60">Bytes per second</CardDescription>
                  </div>
                  <select className="bg-black border border-white/10 text-white rounded px-2 py-1 text-sm"
                          value={netRange} onChange={(e)=>setNetRange(e.target.value as RangeKey)}>
                    <option value="hour">Last hour</option>
                    <option value="day">Last day</option>
                    <option value="week">Last week</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {netMetrics.loading ? (
                  <div className="flex items-center justify-center h-[280px] text-white/40">Loading metrics...</div>
                ) : netMetrics.error ? (
                  <div className="flex items-center justify-center h-[280px] text-red-400 text-sm">{netMetrics.error}</div>
                ) : netInSeries.length === 0 ? (
                  <div className="flex items-center justify-center h-[280px] text-white/40 text-sm">No data available</div>
                ) : (
                  <LineChart data={netInSeries} width={700} height={280} color="#FBBF24" yMin={0} yMax={Math.max(1, netMax)} yPercent={false} formatY={fmtBytes} />
                )}
              </CardContent>
            </Card>

            <Card className="bg-black/50 border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-white">Network Out</CardTitle>
                    <CardDescription className="text-white/60">Bytes per second</CardDescription>
                  </div>
                  <select className="bg-black border border-white/10 text-white rounded px-2 py-1 text-sm"
                          value={netRange} onChange={(e)=>setNetRange(e.target.value as RangeKey)}>
                    <option value="hour">Last hour</option>
                    <option value="day">Last day</option>
                    <option value="week">Last week</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {netMetrics.loading ? (
                  <div className="flex items-center justify-center h-[280px] text-white/40">Loading metrics...</div>
                ) : netMetrics.error ? (
                  <div className="flex items-center justify-center h-[280px] text-red-400 text-sm">{netMetrics.error}</div>
                ) : netOutSeries.length === 0 ? (
                  <div className="flex items-center justify-center h-[280px] text-white/40 text-sm">No data available</div>
                ) : (
                  <LineChart data={netOutSeries} width={700} height={280} color="#F472B6" yMin={0} yMax={Math.max(1, netMax)} yPercent={false} formatY={fmtBytes} />
                )}
              </CardContent>
            </Card>
          </div>

          {confirmAction && confirmAction !== 'rebuild' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-lg border border-white/10 bg-neutral-900 p-5 text-white shadow-xl">
                <h3 className="text-lg font-semibold mb-2">Confirm {confirmAction === 'reboot' ? 'Reboot' : 'Power Off'}</h3>
                <p className="text-white/70 mb-4">Are you sure you want to {confirmAction === 'reboot' ? 'reboot' : 'power off'} <span className="font-medium">{server?.name || 'this VM'}</span>? This may cause temporary downtime.</p>
                <div className="flex justify-end gap-2">
                  <Button onClick={() => setConfirmAction(null)} variant="ghost" className="text-white/80 hover:text-white">Cancel</Button>
                  <Button onClick={async()=>{ const a=confirmAction; setConfirmAction(null); await powerAction(a!); }} className={confirmAction==='reboot' ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 border border-yellow-500/40' : 'bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40'}>
                    Confirm
                  </Button>
                </div>
              </div>
            </div>
          )}

          {confirmAction === 'rebuild' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-lg border border-orange-500/20 bg-neutral-900 p-6 text-white shadow-xl">
                <h3 className="text-xl font-semibold mb-3 text-orange-400 flex items-center gap-2">
                  <FaTrash /> Reset/Rebuild Instance
                </h3>

                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-300 font-semibold mb-2">⚠️ WARNING: DATA DESTRUCTION</p>
                  <ul className="text-white/80 text-sm space-y-1 list-disc list-inside">
                    <li>This will <strong>PERMANENTLY DELETE ALL DATA</strong> on this server</li>
                    <li>The OS will be reinstalled from scratch</li>
                    <li>Your SSH keys will be automatically configured</li>
                    <li>The server will reboot after rebuild completes</li>
                  </ul>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Server:</span>
                    <span className="text-white font-medium">{server?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Current OS:</span>
                    <span className="text-white">{server?.os || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">IP Address:</span>
                    <span className="text-green-400">{server?.ip} (will be preserved)</span>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm text-white/80 mb-2">Type server name to confirm:</label>
                    <input
                      type="text"
                      value={rebuildConfirmName}
                      onChange={(e) => setRebuildConfirmName(e.target.value)}
                      placeholder={server?.name || 'server name'}
                      className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded text-white"
                    />
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rebuildUnderstand}
                      onChange={(e) => setRebuildUnderstand(e.target.checked)}
                      className="mt-1"
                    />
                    <span className="text-sm text-white/80">
                      I understand that all data will be permanently deleted and cannot be recovered
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button onClick={() => { setConfirmAction(null); setRebuildConfirmName(""); setRebuildUnderstand(false); }} variant="ghost" className="text-white/80 hover:text-white">
                    Cancel
                  </Button>
                  <Button
                    onClick={rebuildInstance}
                    disabled={rebuildConfirmName !== server?.name || !rebuildUnderstand}
                    className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaTrash className="mr-2" /> Rebuild Instance
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
