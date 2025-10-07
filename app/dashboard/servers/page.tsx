"use client";

import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FaServer, FaSync, FaCopy, FaPowerOff, FaPlay, FaRedo, FaCheck, FaChevronLeft, FaChevronRight, FaMapMarkerAlt, FaMicrochip, FaHdd, FaMemory, FaInfoCircle, FaCheckCircle, FaExternalLinkAlt, FaThumbsUp, FaWallet, FaExclamationTriangle } from "react-icons/fa";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Sparkline from "@/components/ui/sparkline";
import { calculateHourlyCost, calculateMonthlyCost, formatCurrency, canAffordServer, getEstimatedRuntime, type ServerSpecs } from "@/lib/pricing";
import { LINODE_PLAN_TYPES, LINODE_PLAN_CATEGORIES, getPlansByCategory, getFlagUrl } from "@/lib/linode";
import { Loader, InlineLoader } from "@/components/ui/loader";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import toast from "react-hot-toast";

type Option = { id: string; name?: string; host?: string; ip?: string; mac?: string | null; location?: string };

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

export default function ServersPage() {
  const { user } = useAuth();
  const { balance, loading: walletLoading } = useWallet();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { confirm, ConfirmationDialog } = useConfirmation();

  // Options + view
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<{ locations: Option[]; os: Option[]; ips: Option[]; groupedImages?: any } | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "list">("create");

  // Create form
  const [submitLoading, setSubmitLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [hostname, setHostname] = useState("");
  const [location, setLocation] = useState<string | undefined>(undefined);
  const [os, setOs] = useState<string>("linode/ubuntu24.04");
  const [planType, setPlanType] = useState<string>("g6-standard-2"); // Default plan
  const [planCategory, setPlanCategory] = useState<string>("shared");
  const [sshKeys, setSshKeys] = useState<string[]>([""]);
  const [step, setStep] = useState(0);

  // My Servers
  const [myServers, setMyServers] = useState<any[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [openMonitorId, setOpenMonitorId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, { t: number; cpu: number | null; memUsed: number | null; netIn: number | null; netOut: number | null }[]>>({});

  // View selection from sidebar
  useEffect(() => {
    const v = (searchParams.get("view") || "deploy").toLowerCase();
    setActiveTab(v === "list" ? "list" : "create");
  }, [searchParams]);

  const loadOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/linode/options", { cache: "no-store" });
      const json = await res.json();
      setOptions({
        locations: json.regions || [],
        os: json.images || [],
        ips: [],
        groupedImages: json.groupedImages || {}
      });
      setLocation((prev) => prev ?? json.regions?.[0]?.id);
      if (json.images?.length > 0) setOs(json.images[0].id || json.images[0].label || os);
    } catch (e: any) {
      setError(e?.message || "Failed to load options");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const loadMyServers = async () => {
    if (!user?.id) return;
    setMyLoading(true);
    try {
      const { data, error } = await supabase
        .from("servers")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMyServers(data || []);
    } catch {}
    finally { setMyLoading(false); }
  };

  const syncServerStatus = async (serverId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch("/api/linode/instances/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ serverId }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        console.log('Sync successful:', json.message || json);
        await loadMyServers();
      } else {
        console.error('Sync failed:', json.error);
      }
    } catch (err) {
      console.error('Failed to sync server status:', err);
    }
  };

  const syncAllProvisioning = async () => {
    const provisioningOrRebuilding = myServers.filter(s => s.status === 'provisioning' || s.status === 'rebuilding');
    for (const server of provisioningOrRebuilding) {
      await syncServerStatus(server.id);
    }
  };

  useEffect(() => {
    loadMyServers();
  }, [user?.id]);

  // Immediate sync on load for provisioning/rebuilding servers
  useEffect(() => {
    if (myServers.length > 0) {
      const provisioningOrRebuilding = myServers.filter(s => s.status === 'provisioning' || s.status === 'rebuilding');
      if (provisioningOrRebuilding.length > 0) {
        console.log(`Found ${provisioningOrRebuilding.length} provisioning/rebuilding servers, syncing immediately...`);
        provisioningOrRebuilding.forEach(s => syncServerStatus(s.id));
      }
    }
  }, [myServers.length > 0 ? myServers[0]?.id : null]); // Only trigger once when servers are first loaded

  // Auto-refresh when switching to list view
  useEffect(() => {
    if (activeTab === "list" && user?.id) {
      loadMyServers();
    }
  }, [activeTab, user?.id]);

  // Auto-sync provisioning/rebuilding servers every 10 seconds
  useEffect(() => {
    if (activeTab === "list") {
      const hasProvisioningOrRebuilding = myServers.some(s => s.status === 'provisioning' || s.status === 'rebuilding');
      if (hasProvisioningOrRebuilding) {
        const interval = setInterval(() => {
          syncAllProvisioning();
        }, 10000);
        return () => clearInterval(interval);
      }
    }
  }, [activeTab, myServers]);

  const stepsValid = [
    hostname.trim().length > 0,
    !!location,
    !!os,
    !!planType,
    sshKeys.some(key => key.trim().length > 0),
  ];

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const payload = {
        region: location,
        image: os,
        hostname,
        planType,
        sshKeys: sshKeys.filter(key => key.trim().length > 0),
        ownerId: user?.id,
        ownerEmail: user?.email,
      };
      const res = await fetch("/api/linode/instances/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.status === 409) {
        setError("No available IPs. Try again later."); await loadOptions(); return;
      }
      if (!res.ok || !json.ok) throw new Error(json.error || "Provisioning failed");
      setResult(json);

      // Show success toast and redirect to server list
      toast.success(`Server "${hostname}" deployed successfully!`);
      await loadMyServers(); // Refresh server list

      // Wait a moment for toast to show, then redirect
      setTimeout(() => {
        router.push('/dashboard/servers?view=list');
      }, 1500);

    } catch (err: any) { setError(err?.message || "Provisioning failed"); }
    finally { setSubmitLoading(false); }
  };

  const deployNow = async () => {
    const firstInvalid = stepsValid.findIndex((v) => !v);
    if (firstInvalid >= 0) { setStep(firstInvalid); return; }
    await onSubmit();
  };

  const powerAction = async (serverId: string, action: "start" | "stop" | "reboot") => {
    setActingId(serverId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch("/api/linode/instances/power", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ serverId, action }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Action failed");
      await loadMyServers();
    } finally { setActingId(null); }
  };

  const confirmAndPower = (server: any, action: "reboot" | "stop") => {
    confirm({
      title: `Confirm ${action === 'reboot' ? 'Reboot' : 'Power Off'}`,
      message: `Are you sure you want to ${action === 'reboot' ? 'reboot' : 'power off'} ${server.name || 'this VM'}? This may cause temporary downtime.`,
      confirmText: action === 'reboot' ? 'Reboot' : 'Power Off',
      variant: action === 'reboot' ? 'warning' : 'danger',
      onConfirm: () => powerAction(server.id, action)
    });
  };

  const copyIp = async (ip?: string) => {
    if (!ip) return;
    try {
      await navigator.clipboard.writeText(ip);
      toast.success(`IP ${ip} copied to clipboard`);
    } catch {
      toast.error('Failed to copy IP address');
    }
  };

  const loadMetrics = async (serverId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch(`/api/linode/instances/metrics?serverId=${encodeURIComponent(serverId)}&range=hour`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load metrics");
      setMetrics((m) => ({ ...m, [serverId]: json.series || [] }));
    } catch {}
  };

  const serverSpecs: ServerSpecs = useMemo(() => ({
    planType,
    location
  }), [planType, location]);

  const selectedPlan = useMemo(() => {
    return LINODE_PLAN_TYPES[planType as keyof typeof LINODE_PLAN_TYPES];
  }, [planType]);

  const plansByCategory = useMemo(() => getPlansByCategory(), []);

  const pricing = useMemo(() => {
    const hourly = calculateHourlyCost(serverSpecs);
    const monthly = calculateMonthlyCost(serverSpecs);
    return {
      hourly,
      monthly,
      formatted: `${formatCurrency(hourly)}/hr • ${formatCurrency(monthly)}/mo`
    };
  }, [serverSpecs]);

  const canAfford = useMemo(() => {
    return canAffordServer(balance, serverSpecs, 1);
  }, [balance, serverSpecs]);

  const estimatedRuntime = useMemo(() => {
    return getEstimatedRuntime(balance, serverSpecs);
  }, [balance, serverSpecs]);


  const submitDisabled = useMemo(() => {
    return submitLoading || stepsValid.includes(false) || !canAfford;
  }, [submitLoading, stepsValid, canAfford]);

  return (
    <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Servers</h1>
          <p className="text-white/60 mt-1">Create and manage your VPS</p>
        </div>
      </div>

      {activeTab === "create" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Main column */}
          <div className="md:col-span-9 space-y-4">
            {/* Horizontal breadcrumb */}
            {(() => {
              const steps = [
                { label: "Name", valid: stepsValid[0] },
                { label: "Location", valid: stepsValid[1] },
                { label: "Operating System", valid: stepsValid[2] },
                { label: "Plan", valid: stepsValid[3] },
                { label: "SSH Keys", valid: stepsValid[4] },
              ];
              const canAccess = (i: number) => steps.slice(0, i).every((s) => s.valid);
              return (
                <div className="w-full">
                  <div className="flex items-center justify-between">
                    {steps.map((s, idx) => {
                      const active = step === idx; const done = step > idx && steps[idx].valid; const accessible = idx === 0 || canAccess(idx);
                      return (
                        <div key={idx} className="flex-1 flex items-center">
                          <button type="button" onClick={() => accessible && setStep(idx)} disabled={!accessible} className={`flex items-center gap-2 ${accessible ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] ${done ? "border-green-400 bg-green-500/20 text-green-300" : active ? "border-blue-400 bg-blue-500/20 text-blue-300" : "border-white/20 bg-white/10 text-white/70"}`}>{done ? <FaCheck /> : idx + 1}</div>
                            <span className={`text-xs md:text-sm ${active ? "text-white" : "text-white/70"}`}>{s.label}</span>
                          </button>
                          {idx < steps.length - 1 && (<div className={`mx-2 h-0.5 flex-1 rounded ${canAccess(idx + 1) ? "bg-white/40" : "bg-white/10"}`} />)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <Card className="bg-black/50 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">{["Name","Location","Operating System","Plan","SSH Keys"][step]}</CardTitle>
                <CardDescription className="text-white/60">Step {step + 1} of 5</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {step === 0 && (
                  <div className="space-y-3">
                    <Label className="text-white">Hostname</Label>
                    <Input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="e.g. prod-ubuntu-01" className="bg-black text-white border-white/10" />
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-3">
                    <Label className="text-white">Location</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(options?.locations || []).map((l) => {
                        const id = String(l.id);
                        const countryCode = (l as any).countryCode || 'XX';
                        const flagUrl = (l as any).flagUrl || getFlagUrl(countryCode);
                        const country = (l as any).country || l.name || l.id;
                        const city = (l as any).city || '';
                        return (
                          <button key={id} type="button" onClick={() => setLocation(id)} className={`w-full text-left rounded-xl border px-3 py-3 transition ${location === id ? 'bg-[#60A5FA]/10 border-[#60A5FA] text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`}>
                            <div className="flex items-center gap-3">
                              <Image src={flagUrl} alt={country} width={32} height={32} className="rounded" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-white">{country}</div>
                                {city && <div className="text-xs text-white/60 truncate">{city}</div>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-3">
                    <Label className="text-white">Operating System</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(() => {
                        const groupedImages = (options as any)?.groupedImages || {};
                        return Object.entries(groupedImages).map(([category, images]: [string, any[]]) => {
                          const isSelected = images.some((img: any) => img.id === os);
                          const selectedVersion = images.find((img: any) => img.id === os);
                          const hasMultipleVersions = images.length > 1;

                          return (
                            <div
                              key={category}
                              onClick={!hasMultipleVersions ? () => setOs(images[0].id) : undefined}
                              className={`w-full rounded-xl border p-4 transition flex items-center gap-3 ${
                                isSelected
                                  ? 'bg-[#60A5FA]/10 border-[#60A5FA]'
                                  : 'bg-white/5 border-white/10'
                              } ${!hasMultipleVersions ? 'cursor-pointer hover:bg-white/10' : ''}`}
                            >
                              {images[0]?.logo && (
                                <Image
                                  src={images[0].logo}
                                  alt={category}
                                  width={32}
                                  height={32}
                                  className="rounded object-contain"
                                  unoptimized
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-base font-medium text-white">{category}</div>
                              </div>
                              {hasMultipleVersions && (
                                <div className="w-48">
                                  <Select
                                    value={isSelected ? os : ''}
                                    onValueChange={(val) => setOs(val)}
                                  >
                                    <SelectTrigger className="bg-black text-white border-white/10">
                                      <SelectValue placeholder="Select version" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-black text-white border-white/10">
                                      {images.map((img: any) => (
                                        <SelectItem key={img.id} value={img.id}>
                                          {img.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <Label className="text-white">Plan Category</Label>
                    <div className="flex gap-2 mb-4">
                      {Object.entries(LINODE_PLAN_CATEGORIES).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setPlanCategory(key);
                            const firstPlan = plansByCategory[key]?.[0];
                            if (firstPlan) setPlanType(firstPlan.id);
                          }}
                          className={`px-4 py-2 rounded-lg border transition ${
                            planCategory === key
                              ? 'bg-[#60A5FA]/10 border-[#60A5FA] text-white'
                              : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div>
                      <Label className="text-white mb-3 block">Select Plan</Label>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-white/60 border-b border-white/10">
                              <th className="py-2 pr-4">Plan</th>
                              <th className="py-2 pr-4">vCPU</th>
                              <th className="py-2 pr-4">RAM</th>
                              <th className="py-2 pr-4">Storage</th>
                              <th className="py-2 pr-4">Transfer</th>
                              <th className="py-2 pr-4">Price</th>
                              <th className="py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(plansByCategory[planCategory] || []).map(({ id, plan }) => (
                              <tr
                                key={id}
                                className={`border-b border-white/5 transition ${
                                  planType === id ? 'bg-[#60A5FA]/10' : 'hover:bg-white/5'
                                }`}
                              >
                                <td className="py-3 pr-4 text-white">{plan.label}</td>
                                <td className="py-3 pr-4 text-white/80">{plan.vcpus} cores</td>
                                <td className="py-3 pr-4 text-white/80">{(plan.memory / 1024).toFixed(0)} GB</td>
                                <td className="py-3 pr-4 text-white/80">{(plan.disk / 1024).toFixed(0)} GB</td>
                                <td className="py-3 pr-4 text-white/80">{plan.transfer} GB</td>
                                <td className="py-3 pr-4 text-white/80">${plan.monthly}/mo</td>
                                <td className="py-3">
                                  <button
                                    type="button"
                                    onClick={() => setPlanType(id)}
                                    className={`px-3 py-1 rounded border text-sm transition ${
                                      planType === id
                                        ? 'bg-[#60A5FA]/20 border-[#60A5FA] text-white'
                                        : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                                    }`}
                                  >
                                    {planType === id ? 'Selected' : 'Select'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-white">SSH Public Keys</Label>
                      <p className="text-white/60 text-xs mt-1 mb-2">Add one or more SSH public keys for authentication</p>
                      {sshKeys.map((key, idx) => (
                        <div key={idx} className="flex gap-2 mb-2">
                          <textarea
                            value={key}
                            onChange={(e) => {
                              const newKeys = [...sshKeys];
                              newKeys[idx] = e.target.value;
                              setSshKeys(newKeys);
                            }}
                            placeholder="ssh-rsa AAAAB3NzaC1yc2E... or ssh-ed25519 AAAAC3NzaC1lZ..."
                            className="flex-1 bg-black text-white border-white/10 rounded-md p-2 text-xs font-mono resize-none"
                            rows={3}
                          />
                          {sshKeys.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => setSshKeys(sshKeys.filter((_, i) => i !== idx))}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2 bg-white/5 hover:bg-white/10 text-white border-white/10"
                        onClick={() => setSshKeys([...sshKeys, ""])}
                      >
                        + Add Another Key
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className="bg-white/10 hover:bg-white/20 text-white border border-white/10"><FaChevronLeft className="mr-2" /> Back</Button>
                  {step < 4 ? (
                    <Button type="button" onClick={() => stepsValid[step] && setStep((s) => Math.min(4, s + 1))} disabled={!stepsValid[step]} className="bg-white/10 hover:bg-white/20 text-white border border-white/10 disabled:opacity-50">Next <FaChevronRight className="ml-2" /></Button>
                  ) : (
                    <Button type="button" onClick={deployNow} disabled={submitDisabled} className="bg-white/10 hover:bg-white/20 text-white border border-white/10 disabled:opacity-50">{submitLoading ? <InlineLoader text="Provisioning" /> : "Deploy Instance"}</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div className="md:col-span-3">
            <Card className="bg-black/50 border-white/10 sticky top-16">
              <CardHeader>
                <CardTitle className="text-white text-base">Summary</CardTitle>
                <CardDescription className="text-white/60">Review your configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-white/10"><div className="text-white/60">Hostname</div><div className="text-white break-all ml-4 max-w-[60%] text-right">{hostname || "—"}</div></div>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <div className="text-white/60 flex items-center gap-2"><FaMapMarkerAlt /> Location</div>
                  <div className="text-white ml-4 max-w-[60%] text-right flex items-center gap-2 justify-end">
                    {(() => {
                      const loc = options?.locations.find((l) => l.id === location);
                      const flagUrl = (loc as any)?.flagUrl;
                      const countryCode = (loc as any)?.countryCode;
                      const country = (loc as any)?.country || loc?.name || location;
                      return <>{flagUrl && <Image src={flagUrl} alt={country} width={20} height={20} className="rounded" />}<span>{country || "—"}</span></>;
                    })()}
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <div className="text-white/60">Operating System</div>
                  <div className="text-white ml-4 max-w-[60%] text-right">
                    {(() => {
                      if (!os) return "—";
                      const groupedImages = (options as any)?.groupedImages || {};
                      for (const [category, images] of Object.entries(groupedImages)) {
                        const selectedImg = (images as any[]).find((img: any) => img.id === os);
                        if (selectedImg) {
                          return `${category} ${selectedImg.name}`;
                        }
                      }
                      return os;
                    })()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs bg-white/10 border border-white/10 text-white/90">
                    <FaMicrochip /> {selectedPlan?.vcpus || 0} vCPU
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs bg-white/10 border border-white/10 text-white/90">
                    <FaMemory /> {selectedPlan ? (selectedPlan.memory / 1024).toFixed(0) : 0} GB
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs bg-white/10 border border-white/10 text-white/90">
                    <FaHdd /> {selectedPlan ? (selectedPlan.disk / 1024).toFixed(0) : 0} GB
                  </span>
                </div>

                {/* Pricing */}
                <div className="rounded-lg p-3 bg-gradient-to-r from-white/5 to-white/10 border border-white/10">
                  <div className="text-white/60">Server Cost</div>
                  <div className="text-white text-sm mt-1">{pricing.formatted}</div>
                  <div className="text-white/40 text-[11px] mt-1">Initial charge: {formatCurrency(pricing.hourly)} (1 hour minimum)</div>
                </div>
                <div><Button onClick={deployNow} disabled={submitDisabled} className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10 disabled:opacity-50">{submitLoading ? <InlineLoader text="Provisioning" /> : "Deploy Instance"}</Button></div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "create" && result?.ok && (
        <Card className="bg-black/50 border-white/10">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center"><FaCheckCircle className="h-6 w-6 text-emerald-400" /></div>
            <CardTitle className="text-white mt-3">Instance Created Successfully</CardTitle>
            <CardDescription className="text-white/70">Your server is being started. You can manage it from My Servers.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center gap-3">
            <Button onClick={() => { setActiveTab("list"); loadMyServers(); }} className="bg-white/10 hover:bg-white/20 text-white border border-white/10">Go to My Servers</Button>
            <Button onClick={() => { setStep(0); setResult(null); setHostname(""); setSshKeys([""]); setPlanType("g6-standard-2"); }} className="bg-white/5 hover:bg-white/10 text-white border border-white/10" variant="outline">Deploy Another</Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "list" && (
        <Card className="bg-black/50 border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">My Servers</CardTitle>
                <CardDescription className="text-white/60">
                  Provisioned servers associated with your account
                  {myServers.some(s => s.status === 'provisioning' || s.status === 'rebuilding') && (
                    <span className="ml-2 text-yellow-400">• Auto-syncing {myServers.filter(s => s.status === 'provisioning' || s.status === 'rebuilding').length} server(s)...</span>
                  )}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {myServers.some(s => s.status === 'provisioning' || s.status === 'rebuilding') && (
                  <Button onClick={syncAllProvisioning} className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 border border-yellow-500/40">
                    <FaSync className="h-4 w-4 mr-2" />Sync All
                  </Button>
                )}
                <Button onClick={loadMyServers} className="bg-white/10 hover:bg-white/20 text-white border border-white/10" disabled={myLoading}>
                  <FaSync className={`h-4 w-4 mr-2 ${myLoading ? 'animate-spin' : ''}`} />Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {myLoading ? (<div className="flex justify-center py-8"><InlineLoader text="Loading servers" /></div>) : myServers.length === 0 ? (<div className="text-white/60">No servers yet.</div>) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/60 border-b border-white/10">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Region</th>
                      <th className="py-2 pr-4">IP</th>
                      <th className="py-2 pr-4">Configuration</th>
                      <th className="py-2 pr-4">OS</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myServers.map((s) => {
                      const regionObj = options?.locations?.find((l) => l.id === s.location);
                      const regionFlagUrl = (regionObj as any)?.flagUrl;
                      const regionCountryCode = (regionObj as any)?.countryCode || 'XX';
                      const regionName = (regionObj as any)?.country || regionObj?.name || s.location || 'N/A';
                      const specs = `${s.cpu_cores || '?' } vCPU • ${s.memory_mb || 0} MB${s.disk_gb ? ` • ${s.disk_gb} GB` : ''}`;
                      const sshCmd = `ssh root@${s.ip}`;
                      const stopped = String(s.status || '').toLowerCase() === 'stopped';
                      const specStr = `${s.cpu_cores || '?' } vCPU` + ` • ${s.memory_mb || 0} MB` + (s.disk_gb ? ` • ${s.disk_gb} GB` : '');

                      // Format OS name
                      let osDisplay = s.os || 'N/A';
                      if (osDisplay.startsWith('linode/')) {
                        // Try to find in grouped images
                        const groupedImages = (options as any)?.groupedImages || {};
                        let found = false;
                        for (const [category, images] of Object.entries(groupedImages)) {
                          const selectedImg = (images as any[]).find((img: any) => img.id === s.os);
                          if (selectedImg) {
                            osDisplay = `${category} ${selectedImg.name}`;
                            found = true;
                            break;
                          }
                        }
                        // If not found in grouped images, just remove "linode/" prefix
                        if (!found) {
                          osDisplay = osDisplay.replace('linode/', '').replace('-', ' ');
                          // Capitalize first letter of each word
                          osDisplay = osDisplay.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                        }
                      }

                      return (
                          <tr key={s.id} className="border-b border-white/5">
                            <td className="py-2 pr-4 text-white">{s.name}</td>
                            <td className="py-2 pr-4 text-white/80">
                              <span className="inline-flex items-center gap-2">
                                {regionFlagUrl && <Image src={regionFlagUrl} alt={regionName} width={20} height={20} className="rounded" />}
                                <span>{regionName}</span>
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-white/80">
                              <div className="inline-flex items-center gap-2">
                                <span>{s.ip}</span>
                                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-white/70 hover:text-white" title="Copy IP" onClick={() => copyIp(s.ip)}><FaCopy className="h-3.5 w-3.5" /></Button>
                              </div>
                            </td>
                            <td className="py-2 pr-4 text-white/80">{specStr}</td>
                            <td className="py-2 pr-4 text-white/80">{osDisplay}</td>
                            <td className="py-2 pr-4">
                              <span className={`inline-flex items-center gap-1 ${
                                s.status === 'running' ? 'text-green-400' :
                                s.status === 'provisioning' || s.status === 'rebuilding' ? 'text-yellow-400' :
                                s.status === 'offline' || s.status === 'stopped' ? 'text-red-400' :
                                'text-white/80'
                              }`}>
                                {s.status || 'N/A'}
                                {(s.status === 'provisioning' || s.status === 'rebuilding') && <FaSync className="animate-spin text-xs ml-1" />}
                              </span>
                            </td>
                            <td className="py-2 pr-4 space-x-2 whitespace-nowrap">
                              <Button type="button" size="sm" variant="ghost" className="text-white/80 hover:text-white" title="Copy SSH command" onClick={() => {
                                try {
                                  navigator.clipboard.writeText(sshCmd);
                                  toast.success('SSH command copied to clipboard');
                                } catch {
                                  toast.error('Failed to copy SSH command');
                                }
                              }}><FaCopy className="h-3.5 w-3.5 mr-2" /> SSH</Button>
                              {stopped ? (
                                <Button type="button" size="sm" className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 cursor-pointer" onClick={() => powerAction(s.id, 'start')} disabled={actingId === s.id} title="Start VM"><FaPlay className="h-3.5 w-3.5 mr-2" /> Start</Button>
                              ) : (
                                <>
                                  <Button type="button" size="sm" className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 border border-yellow-500/40 cursor-pointer" onClick={() => confirmAndPower(s, 'reboot')} disabled={actingId === s.id} title="Reboot VM">
                                    <FaRedo className="h-3.5 w-3.5 mr-2" />
                                    Reboot
                                  </Button>
                                  <Button type="button" size="sm" className="bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 cursor-pointer" onClick={() => confirmAndPower(s, 'stop')} disabled={actingId === s.id} title="Power Off VM">
                                    <FaPowerOff className="h-3.5 w-3.5 mr-2" />
                                    Power Off
                                  </Button>
                                </>
                              )}
                              <Link href={`/dashboard/servers/${encodeURIComponent(s.id)}`} className="inline-block" title="Actions">
                                <Button type="button" size="sm" className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 cursor-pointer">
                                  <FaExternalLinkAlt className="h-3.5 w-3.5 mr-2" /> Actions
                                </Button>
                              </Link>
                            </td>
                          </tr>
                          
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <ConfirmationDialog />
    </motion.div>
  );
}
