﻿"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import Footer from "@/components/Footer";
import { FaBitcoin, FaEthereum, FaShieldAlt, FaBolt, FaServer, FaMicrochip, FaHdd, FaNetworkWired, FaLock, FaGlobe, FaClock, FaCloudUploadAlt, FaCode, FaHeadset } from "react-icons/fa";
import { useMemo, useState } from "react";
import { generateToken } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, LogIn, RefreshCw } from "lucide-react";
import { useAuth } from "@/app/provider";

// Lazy load heavy WebGL components
const LightRays = dynamic(() => import("@/components/LightRays"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-gradient-to-b from-black via-blue-950/20 to-black" />
});

const WorldMap = dynamic(() => import("@/components/ui/world-map").then(mod => ({ default: mod.WorldMap })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] flex items-center justify-center">
      <div className="text-white/50 text-sm">Loading map...</div>
    </div>
  )
});

export default function Home() {
  const { user } = useAuth();
  const [token, setToken] = useState(generateToken());
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshToken = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const newToken = generateToken();
    setToken(newToken);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        toast.success("Signed in successfully. Welcome back!");
        window.location.href = '/dashboard/servers';
      } else {
        const error = await response.json();
        toast.error(error.error || "Authentication failed");
      }
    } catch {
      toast.error("Failed to authenticate. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Linode regions showcased on the map - ALL REGIONS
  const regions = [
    // Americas
    "us-east",
    "us-central", 
    "us-west",
    "us-southeast",
    "us-lax",
    "us-mia",
    "us-sea",
    "us-ord",
    "us-iad",
    "ca-central",
    "br-gru",
    // Europe
    "eu-west",
    "gb-lon",
    "eu-central",
    "de-fra-2",
    "fr-par",
    "it-mil",
    "nl-ams",
    "se-sto",
    "es-mad",
    // Asia Pacific
    "ap-south",
    "sg-sin-2",
    "ap-northeast",
    "jp-tyo-3",
    "jp-osa",
    "ap-southeast",
    "au-mel",
    "ap-west",
    "in-bom-2",
    "in-maa",
    "id-cgk",
  ];

  const regionCoords = useMemo(() => ({
    // Americas
    "us-east": { lat: 40.7357, lng: -74.1724 },        // Newark, NJ
    "us-central": { lat: 32.7767, lng: -96.7970 },     // Dallas, TX
    "us-west": { lat: 37.5483, lng: -121.9886 },       // Fremont, CA
    "us-southeast": { lat: 33.7490, lng: -84.3880 },   // Atlanta, GA
    "us-lax": { lat: 34.0522, lng: -118.2437 },        // Los Angeles, CA
    "us-mia": { lat: 25.7617, lng: -80.1918 },         // Miami, FL
    "us-sea": { lat: 47.6062, lng: -122.3321 },        // Seattle, WA
    "us-ord": { lat: 41.8781, lng: -87.6298 },         // Chicago, IL
    "us-iad": { lat: 38.9072, lng: -77.0369 },         // Washington, DC
    "ca-central": { lat: 43.6532, lng: -79.3832 },     // Toronto, Canada
    "br-gru": { lat: -23.5505, lng: -46.6333 },        // São Paulo, Brazil
    // Europe
    "eu-west": { lat: 51.5074, lng: -0.1278 },         // London, UK
    "gb-lon": { lat: 51.5074, lng: -0.1278 },          // London 2, UK
    "eu-central": { lat: 50.1109, lng: 8.6821 },       // Frankfurt, Germany
    "de-fra-2": { lat: 50.1109, lng: 8.6821 },         // Frankfurt 2, Germany
    "fr-par": { lat: 48.8566, lng: 2.3522 },           // Paris, France
    "it-mil": { lat: 45.4642, lng: 9.1900 },           // Milan, Italy
    "nl-ams": { lat: 52.3676, lng: 4.9041 },           // Amsterdam, Netherlands
    "se-sto": { lat: 59.3293, lng: 18.0686 },          // Stockholm, Sweden
    "es-mad": { lat: 40.4168, lng: -3.7038 },          // Madrid, Spain
    // Asia Pacific
    "ap-south": { lat: 1.3521, lng: 103.8198 },        // Singapore
    "sg-sin-2": { lat: 1.3521, lng: 103.8198 },        // Singapore 2
    "ap-northeast": { lat: 35.6762, lng: 139.6503 },   // Tokyo, Japan
    "jp-tyo-3": { lat: 35.6762, lng: 139.6503 },       // Tokyo 3, Japan
    "jp-osa": { lat: 34.6937, lng: 135.5023 },         // Osaka, Japan
    "ap-southeast": { lat: -33.8688, lng: 151.2093 },  // Sydney, Australia
    "au-mel": { lat: -37.8136, lng: 144.9631 },        // Melbourne, Australia
    "ap-west": { lat: 19.0760, lng: 72.8777 },         // Mumbai, India
    "in-bom-2": { lat: 19.0760, lng: 72.8777 },        // Mumbai 2, India
    "in-maa": { lat: 13.0827, lng: 80.2707 },          // Chennai, India
    "id-cgk": { lat: -6.2088, lng: 106.8456 },         // Jakarta, Indonesia
  }), []);

  // Use Frankfurt as a neutral hub to visualize connectivity
  const hub = { lat: 50.1109, lng: 8.6821 };
  const regionNames: Record<string, string> = {
    // Americas
    "us-east": "Newark, NJ",
    "us-central": "Dallas, TX",
    "us-west": "Fremont, CA",
    "us-southeast": "Atlanta, GA",
    "us-lax": "Los Angeles, CA",
    "us-mia": "Miami, FL",
    "us-sea": "Seattle, WA",
    "us-ord": "Chicago, IL",
    "us-iad": "Washington, DC",
    "ca-central": "Toronto, Canada",
    "br-gru": "São Paulo, Brazil",
    // Europe
    "eu-west": "London, UK",
    "gb-lon": "London, UK",
    "eu-central": "Frankfurt, Germany",
    "de-fra-2": "Frankfurt, Germany",
    "fr-par": "Paris, France",
    "it-mil": "Milan, Italy",
    "nl-ams": "Amsterdam, Netherlands",
    "se-sto": "Stockholm, Sweden",
    "es-mad": "Madrid, Spain",
    // Asia Pacific
    "ap-south": "Singapore",
    "sg-sin-2": "Singapore",
    "ap-northeast": "Tokyo, Japan",
    "jp-tyo-3": "Tokyo, Japan",
    "jp-osa": "Osaka, Japan",
    "ap-southeast": "Sydney, Australia",
    "au-mel": "Melbourne, Australia",
    "ap-west": "Mumbai, India",
    "in-bom-2": "Mumbai, India",
    "in-maa": "Chennai, India",
    "id-cgk": "Jakarta, Indonesia",
  };

  const dots = useMemo(() => {
    return regions
      .map((slug) => ({ slug, coord: (regionCoords as any)[slug] }))
      .filter((r) => r.coord)
      .map(({ slug, coord }) => ({
        start: { ...(coord as any), label: regionNames[slug] || slug },
        end: { ...hub, label: "Hub" },
      }));
  }, [regions, regionCoords]);

  return (
    <main className="relative min-h-[100svh] bg-black overflow-hidden">
      <div className="absolute inset-0">
        <LightRays
          raysOrigin="top-center"
          raysColor="#00E5FF"
          raysSpeed={0.18}
          lightSpread={1.6}
          rayLength={3.2}
          pulsating={true}
          fadeDistance={1.4}
          saturation={1.0}
          followMouse={true}
          mouseInfluence={0.1}
          noiseAmount={0.0}
          distortion={0.04}
          className="opacity-70 md:opacity-80"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/90" />

      <section className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 min-h-[calc(100svh-56px)] flex items-center py-16 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center md:text-left"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 mb-6">
            <FaShieldAlt className="h-3.5 w-3.5 text-[#60A5FA]" />
            <span>Private • Global</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-white">
            Cloud Infrastructure
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#60A5FA] via-[#3B82F6] to-[#22d3ee]">
              Servers in Seconds
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-white/70 mx-auto md:mx-0 text-base md:text-lg">
            Deploy anywhere, pay however. Launch secure virtual servers across global regions and pay with BTC/ETH/XMR.
          </p>

          {!user ? (
            <form onSubmit={handleAuth} className="mt-8 max-w-md">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter your token"
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[#60A5FA] focus:border-transparent backdrop-blur-sm"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={handleRefreshToken}
                    disabled={isRefreshing || isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white focus:outline-none disabled:cursor-not-allowed"
                    title="Generate new token"
                    aria-label={isRefreshing ? "Regenerating" : "Regenerate authentication token"}
                  >
                    <div className="relative w-4 h-4">
                      <div
                        className={`absolute inset-0 transition-all duration-200 ${
                          isRefreshing ? "scale-100 opacity-100" : "scale-0 opacity-0"
                        }`}
                      >
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      </div>
                      <div
                        className={`absolute inset-0 transition-all duration-200 ${
                          isRefreshing ? "scale-0 opacity-0" : "scale-100 opacity-100"
                        }`}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] px-6 py-3 text-white font-medium shadow-lg shadow-[#60A5FA]/20 hover:from-[#3B82F6] hover:to-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" /> Get Started
                    </>
                  )}
                </button>
              </div>
              <p className="mt-3 text-white/50 text-sm">
                Enter your authentication token or{' '}
                <button
                  type="button"
                  onClick={handleRefreshToken}
                  className="text-[#60A5FA] hover:text-[#3B82F6] underline underline-offset-2"
                >
                  click to generate a new one
                </button>
              </p>
            </form>
          ) : (
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link href="/dashboard/servers" className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] px-6 py-3 text-white font-medium shadow-lg shadow-[#60A5FA]/20 hover:from-[#3B82F6] hover:to-[#1D4ED8] transition-colors">
                <FaServer className="mr-2 h-4 w-4" /> Go to Dashboard
              </Link>
            </div>
          )}

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <FaBolt className="h-4 w-4 text-yellow-300" />
              <span className="text-white/80">Provision in under 60s</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <FaShieldAlt className="h-4 w-4 text-[#60A5FA]" />
              <span className="text-white/80">Private by design</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex -space-x-2 items-center">
                <FaBitcoin className="h-4 w-4 text-orange-400" />
                <FaEthereum className="h-4 w-4 text-blue-400 -ml-1" />
              </div>
              <span className="text-white/80">Pay with BTC / ETH / XMR</span>
            </div>
          </div>
        </motion.div>

        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-[#60A5FA]/20 blur-3xl" />
          <div className="absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-[#22d3ee]/20 blur-3xl" />
        </div>
      </section>

      {/* Global map */}
      <section id="regions" className="relative z-10 bg-black">
        <div className="max-w-7xl mx-auto px-6 md:px-10 min-h-[calc(100svh-56px)] flex flex-col justify-center py-16 md:py-20">
          <div className="text-center mb-8 md:mb-10">
            <motion.h2
              className="mt-4 md:mt-6 text-2xl md:text-3xl font-semibold text-white"
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6 }}
            >
              Global Coverage
            </motion.h2>
            <motion.p
              className="text-white/60 max-w-2xl mx-auto mt-2"
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              31 global locations across North America, Europe, Asia-Pacific, and South America. Deploy where your users are.
            </motion.p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <WorldMap dots={dots} lineColor="#3B82F6" hideEndDots hideLines />
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section id="features" className="relative z-10 bg-black">
        {/* Subtle section background hue */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#3B82F6]/15 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-[#3B82F6]/10 blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-6 md:px-10 min-h-[calc(100svh-56px)] flex flex-col justify-center py-16 md:py-20">
          <div className="text-center mb-8 md:mb-10">
            <motion.h2
              className="text-2xl md:text-3xl font-semibold text-white"
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6 }}
            >
              Built For Demanding Workloads
            </motion.h2>
            <motion.p
              className="text-white/60 max-w-2xl mx-auto mt-2"
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Modern compute, storage and network — engineered for speed, reliability and security.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                icon: <FaMicrochip className="h-5 w-5 text-white" />,
                title: 'Latest‑Gen CPUs',
                desc: 'AMD Ryzen, EPYC and Intel Xeon platforms tuned for performance.'
              },
              {
                icon: <FaHdd className="h-5 w-5 text-white" />,
                title: 'NVMe SSD',
                desc: 'High IOPS storage for rapid builds, databases and caching.'
              },
              {
                icon: <FaNetworkWired className="h-5 w-5 text-white" />,
                title: 'HA Network',
                desc: 'Redundant links and smart routing for consistent throughput.'
              },
              {
                icon: <FaShieldAlt className="h-5 w-5 text-white" />,
                title: 'Hardened Security',
                desc: 'Isolated tenants, secure images and optional DDoS protection.'
              },
              {
                icon: <FaGlobe className="h-5 w-5 text-white" />,
                title: 'Global Coverage',
                desc: 'Regions across North America, Europe and APAC.'
              },
              {
                icon: <FaClock className="h-5 w-5 text-white" />,
                title: '99.99% Uptime',
                desc: 'Reliable platform with continuous monitoring and alerting.'
              },
              {
                icon: <FaCloudUploadAlt className="h-5 w-5 text-white" />,
                title: 'Instant Provisioning',
                desc: 'Launch in seconds with optimized OS templates.'
              },
              {
                icon: <FaCode className="h-5 w-5 text-white" />,
                title: 'API & Automation',
                desc: 'Integrate with CI/CD and tooling via simple REST endpoints.'
              },
              {
                icon: <FaHeadset className="h-5 w-5 text-white" />,
                title: 'Expert Support',
                desc: 'Guidance from engineers who understand production workloads.'
              }
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 p-5 backdrop-blur-sm"
              >
                <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-[#3B82F6]/10 blur-2xl" />
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6]/30 to-[#3B82F6]/50 border border-white/10 flex items-center justify-center">
                  {f.icon}
                </div>
                <h3 className="text-white mt-4 font-medium">{f.title}</h3>
                <p className="text-white/70 text-sm mt-1 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
