"use client";

import { motion } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { useWallet } from "@/hooks/useWallet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FaServer, FaSync, FaCopy, FaPowerOff, FaPlay, FaRedo, FaCheck, FaChevronLeft, FaChevronRight, FaMapMarkerAlt, FaMicrochip, FaHdd, FaMemory, FaInfoCircle, FaCheckCircle, FaExternalLinkAlt, FaThumbsUp, FaWallet, FaExclamationTriangle, FaTrash } from "react-icons/fa";
import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const { user } = useUser();
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
  
  // Pricing state
  const [pricing, setPricing] = useState<{ hourly: number; monthly: number; formatted: string }>({
    hourly: 0,
    monthly: 0,
    formatted: '$0.00/hr • $0.00/mo'
  });
  const [canAfford, setCanAfford] = useState(false);
  const [estimatedRuntime, setEstimatedRuntime] = useState(0);
  const [allPlansPricing, setAllPlansPricing] = useState<Record<string, { hourly: number; monthly: number }>>({});

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
      const supabase = createClient();
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

  useEffect(() => {
    loadMyServers();
  }, [user?.id]);

  // Auto-refresh when switching to list view
  useEffect(() => {
    if (activeTab === "list" && user?.id) {
      loadMyServers();
    }
  }, [activeTab, user?.id]);

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
      const supabase = createClient();
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
      const supabase = createClient();
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

  const deleteServer = (server: any) => {
    confirm({
      title: 'Delete Server',
      message: `Are you sure you want to delete "${server.name || 'this server'}"? This will permanently delete the server from both the database and Linode. All data will be lost. This action cannot be undone.`,
      confirmText: 'Delete Server',
      variant: 'danger',
      onConfirm: async () => {
        setActingId(server.id);
        try {
          const supabase = createClient();
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token;

          const res = await fetch('/api/linode/instances/delete', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({ serverId: server.id }),
          });

          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Failed to delete server');
          }

          // Show detailed success message
          if (data.linodeError) {
            toast.error(`${data.message}: ${data.linodeError}`);
          } else if (data.linodeDeleted && server.linode_id) {
            toast.success('✅ Server deleted from both database and Linode');
          } else if (!server.linode_id) {
            toast.success('⚠️ Server deleted from database (no Linode ID found)');
          } else {
            toast.success(data.message || 'Server deleted successfully');
          }

          await loadMyServers();
        } catch (error: any) {
          console.error('Error deleting server:', error);
          toast.error(error.message || 'Failed to delete server');
        } finally {
          setActingId(null);
        }
      }
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
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch(`/api/linode/instances/metrics?serverId=${encodeURIComponent(serverId)}&range=hour`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load metrics");
      setMetrics((m) => ({ ...m, [serverId]: json.series || [] }));
    } catch {}
  };

  const selectedPlan = useMemo(() => {
    return LINODE_PLAN_TYPES[planType as keyof typeof LINODE_PLAN_TYPES];
  }, [planType]);

  const plansByCategory = useMemo(() => getPlansByCategory(), []);

  // Load all plans pricing on mount
  useEffect(() => {
    const loadAllPricing = async () => {
      const pricingMap: Record<string, { hourly: number; monthly: number }> = {};
      
      // Load pricing for all plans
      for (const planId of Object.keys(LINODE_PLAN_TYPES)) {
        const serverSpecs = { planType: planId, location };
        const hourly = await calculateHourlyCost(serverSpecs);
        const monthly = await calculateMonthlyCost(serverSpecs);
        pricingMap[planId] = { hourly, monthly };
      }
      
      setAllPlansPricing(pricingMap);
    };
    
    loadAllPricing();
  }, []); // Only load once on mount

  // Calculate pricing when specs change
  useEffect(() => {
    const updatePricing = async () => {
      const serverSpecs = { planType, location };
      const hourly = await calculateHourlyCost(serverSpecs);
      const monthly = await calculateMonthlyCost(serverSpecs);
      setPricing({
        hourly,
        monthly,
        formatted: `${formatCurrency(hourly)}/hr • ${formatCurrency(monthly)}/mo`
      });
      
      const afford = await canAffordServer(balance, serverSpecs, 1);
      setCanAfford(afford);
      
      const runtime = await getEstimatedRuntime(balance, serverSpecs);
      setEstimatedRuntime(runtime);
    };
    
    updatePricing();
  }, [planType, location, balance]);


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
                            {(plansByCategory[planCategory] || []).map(({ id, plan }) => {
                              const planPricing = allPlansPricing[id];
                              const displayPrice = planPricing ? planPricing.monthly : plan.monthly;
                              
                              return (
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
                                <td className="py-3 pr-4 text-white/80">${displayPrice.toFixed(2)}/mo</td>
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
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-white text-base font-semibold">SSH Public Keys</Label>
                      <p className="text-white/60 text-sm mt-2 mb-4">Add one or more SSH public keys for secure authentication. You'll use these to connect to your server.</p>
                      <div className="space-y-3">
                        {sshKeys.map((key, idx) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-white/80 text-sm">Key #{idx + 1}</Label>
                              {sshKeys.length > 1 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7"
                                  onClick={() => setSshKeys(sshKeys.filter((_, i) => i !== idx))}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                            <textarea
                              value={key}
                              onChange={(e) => {
                                const newKeys = [...sshKeys];
                                newKeys[idx] = e.target.value;
                                setSshKeys(newKeys);
                              }}
                              placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC... user@hostname&#10;or&#10;ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... user@hostname"
                              className="w-full bg-white/5 text-white border-2 border-white/20 focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 rounded-lg p-3 text-xs font-mono resize-none transition-all placeholder:text-white/30"
                              rows={4}
                            />
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-4 bg-white/5 hover:bg-white/10 text-white border-white/20 hover:border-white/30"
                        onClick={() => setSshKeys([...sshKeys, ""])}
                      >
                        + Add Another Key
                      </Button>
                      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="flex gap-2">
                          <FaInfoCircle className="text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-white/80">
                            <p className="font-medium text-white mb-1">How to generate SSH keys:</p>
                            <code className="block bg-black/50 px-2 py-1 rounded mt-1 text-white/90">ssh-keygen -t ed25519 -C "your_email@example.com"</code>
                            <p className="mt-2 text-white/70">Then copy the contents of <code className="bg-black/50 px-1 rounded">~/.ssh/id_ed25519.pub</code></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className="bg-white/10 hover:bg-white/20 text-white border border-white/10"><FaChevronLeft className="mr-2" /> Back</Button>
                  {step < 4 ? (
                    <Button type="button" onClick={() => stepsValid[step] && setStep((s) => Math.min(4, s + 1))} disabled={!stepsValid[step]} className="bg-white/10 hover:bg-white/20 text-white border border-white/10 disabled:opacity-50">Next <FaChevronRight className="ml-2" /></Button>
                  ) : (
                    <div className="flex flex-col items-end gap-2">
                      {submitDisabled && !submitLoading && (
                        <p className="text-sm text-red-400 flex items-center gap-2">
                          <FaExclamationTriangle />
                          {!canAfford 
                            ? `Insufficient balance. Need ${formatCurrency(pricing.hourly - balance)}/hr more` 
                            : !stepsValid[0] 
                            ? "Please enter a hostname" 
                            : !stepsValid[1] 
                            ? "Please select a location" 
                            : !stepsValid[2] 
                            ? "Please select an operating system" 
                            : !stepsValid[3] 
                            ? "Please select a plan" 
                            : !stepsValid[4] 
                            ? "Please enter at least one SSH key" 
                            : "Please complete all required fields"}
                        </p>
                      )}
                      <Button type="button" onClick={deployNow} disabled={submitDisabled} className="bg-white/10 hover:bg-white/20 text-white border border-white/10 disabled:opacity-50">{submitLoading ? <InlineLoader text="Provisioning" /> : "Deploy Instance"}</Button>
                    </div>
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
                
                {/* Error message */}
                {submitDisabled && !submitLoading && (
                  <div className="rounded-lg p-3 bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-400 flex items-center gap-2">
                      <FaExclamationTriangle />
                      {!canAfford 
                        ? `Insufficient balance. Need ${formatCurrency(pricing.hourly - balance)}/hr more` 
                        : !stepsValid[0] 
                        ? "Please enter a hostname" 
                        : !stepsValid[1] 
                        ? "Please select a location" 
                        : !stepsValid[2] 
                        ? "Please select an operating system" 
                        : !stepsValid[3] 
                        ? "Please select a plan" 
                        : !stepsValid[4] 
                        ? "Please enter at least one SSH key" 
                        : "Please complete all required fields"}
                    </p>
                  </div>
                )}
                
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
                </CardDescription>
              </div>
              <div className="flex gap-2">
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
                              <Button type="button" size="sm" className="bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-600/40 cursor-pointer" onClick={() => deleteServer(s)} disabled={actingId === s.id} title="Delete Server">
                                <FaTrash className="h-3.5 w-3.5 mr-2" />
                                Delete
                              </Button>
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
