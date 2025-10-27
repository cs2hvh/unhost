"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Footer from "@/components/Footer";
import { FaRocket, FaGlobe, FaShieldAlt, FaBolt } from "react-icons/fa";

export default function AboutPage() {
  return (
    <>
      <div className="bg-black text-white">
        {/* Hero Section */}
        <section className="relative py-16 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h1 className="text-3xl md:text-4xl font-bold mb-3">About Us</h1>
            <p className="text-white/50 text-sm">
              Deploy anywhere, pay however.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="border border-white/10 rounded-lg p-6 bg-white/[0.02] mb-12"
        >
          <div className="flex items-center gap-2 mb-4">
            <FaRocket className="text-white/40" />
            <h2 className="text-xl font-semibold">Our Mission</h2>
          </div>
          <p className="text-white/60 text-sm leading-relaxed">
            We're democratizing cloud infrastructure by making it accessible and affordable for everyone. By accepting cryptocurrency payments, we enable anyone, anywhere to deploy powerful servers without traditional banking barriers. We believe in privacy, transparency, and putting control back in your hands.
          </p>
        </motion.div>

        {/* Values Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="border border-white/10 rounded-lg p-6 bg-white/[0.02]"
          >
            <div className="flex items-center gap-2 mb-3">
              <FaGlobe className="text-white/40" />
              <h3 className="text-lg font-semibold">Global Reach</h3>
            </div>
            <p className="text-white/60 text-sm">
              With 31 data centers across 6 continents, we bring your applications closer to your users worldwide.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="border border-white/10 rounded-lg p-6 bg-white/[0.02]"
          >
            <div className="flex items-center gap-2 mb-3">
              <FaShieldAlt className="text-white/40" />
              <h3 className="text-lg font-semibold">Privacy First</h3>
            </div>
            <p className="text-white/60 text-sm">
              Cryptocurrency payments mean no credit card tracking. Our infrastructure is built with security at every layer.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="border border-white/10 rounded-lg p-6 bg-white/[0.02]"
          >
            <div className="flex items-center gap-2 mb-3">
              <FaBolt className="text-white/40" />
              <h3 className="text-lg font-semibold">Lightning Fast</h3>
            </div>
            <p className="text-white/60 text-sm">
              Deploy servers in seconds. Our streamlined infrastructure and automated provisioning get you up and running instantly.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="border border-white/10 rounded-lg p-6 bg-white/[0.02]"
          >
            <div className="flex items-center gap-2 mb-3">
              <FaRocket className="text-white/40" />
              <h3 className="text-lg font-semibold">Simple & Affordable</h3>
            </div>
            <p className="text-white/60 text-sm">
              No hidden fees, no long-term commitments. Pay only for what you use with transparent pricing.
            </p>
          </motion.div>
        </div>

        {/* Story Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="border border-white/10 rounded-lg p-6 bg-white/[0.02] mb-12"
        >
          <h2 className="text-xl font-semibold mb-4">Our Story</h2>
          <div className="space-y-4 text-white/60 text-sm leading-relaxed">
            <p>
              We started with a simple observation: cloud infrastructure is expensive, complicated, and inaccessible to many developers around the world. Traditional providers require credit cards, complex verification processes, and long-term commitments.
            </p>
            <p>
              We asked ourselves: what if deploying a server was as simple as sending cryptocurrency? What if there were no sign-up barriers, no credit checks, and no geographic restrictions?
            </p>
            <p>
              That vision became reality. Today, we serve developers, startups, and businesses across the globe, enabling them to launch projects without the traditional constraints of cloud infrastructure.
            </p>
          </div>
        </motion.div>

        {/* Tech Stack */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="border border-white/10 rounded-lg p-6 bg-white/[0.02]"
        >
          <h2 className="text-xl font-semibold mb-4">Technology</h2>
          <div className="grid md:grid-cols-3 gap-6 text-white/60 text-sm">
            <div>
              <h3 className="text-white font-medium mb-2">Infrastructure</h3>
              <ul className="space-y-1">
                <li>• Linode Cloud</li>
                <li>• 31 Global Regions</li>
                <li>• NVMe SSD Storage</li>
                <li>• 40 Gbps Network</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">Payments</h3>
              <ul className="space-y-1">
                <li>• Cryptocurrency Support</li>
                <li>• Multiple Coins</li>
                <li>• Instant Processing</li>
                <li>• No Chargebacks</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">Security</h3>
              <ul className="space-y-1">
                <li>• End-to-End Encryption</li>
                <li>• DDoS Protection</li>
                <li>• 24/7 Monitoring</li>
                <li>• Regular Backups</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </section>
      </div>

      <Footer />
    </>
  );
}
