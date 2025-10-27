"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Footer from "@/components/Footer";
import { FaShieldAlt, FaLock, FaDatabase, FaCookie, FaEnvelope } from "react-icons/fa";

export default function PrivacyPage() {
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
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Privacy Policy</h1>
            <p className="text-white/50 text-sm">Last Updated: October 27, 2025</p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-10">
          {/* Introduction */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="prose prose-invert max-w-none"
          >
            <p className="text-white/60 leading-relaxed">
              This Privacy Policy describes how we collect, use, store, and protect your personal information when you use our cloud infrastructure services. By using our services, you agree to the terms outlined in this policy.
            </p>
          </motion.div>

          {/* Information We Collect */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <FaDatabase className="text-white/40" />
              <h2 className="text-xl font-semibold">Information We Collect</h2>
            </div>
            <div className="space-y-4 text-white/60 text-sm leading-relaxed">
              <div>
                <h3 className="text-white font-medium mb-1">Account Information</h3>
                <p>We collect your email address and authentication tokens when you create an account.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Server Information</h3>
                <p>We store information about the servers you deploy, including hostnames, IP addresses, and specifications.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Payment Information</h3>
                <p>We process cryptocurrency payments through third-party providers. Transaction details are stored for billing purposes.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Usage Data</h3>
                <p>We collect data about how you interact with our services, including server creation and resource usage.</p>
              </div>
            </div>
          </motion.div>

          {/* How We Use Your Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2 className="text-xl font-semibold mb-4">How We Use Your Information</h2>
            <ul className="space-y-2 text-white/60 text-sm">
              <li>• Provide and maintain our cloud infrastructure services</li>
              <li>• Process your transactions and manage billing</li>
              <li>• Send you service updates and security alerts</li>
              <li>• Monitor and analyze usage to improve our services</li>
              <li>• Detect, prevent, and address technical issues</li>
              <li>• Comply with legal obligations</li>
            </ul>
          </motion.div>

          {/* Data Security */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <FaLock className="text-white/40" />
              <h2 className="text-xl font-semibold">Data Security</h2>
            </div>
            <p className="text-white/60 text-sm mb-3">We implement industry-standard security measures to protect your information:</p>
            <ul className="space-y-2 text-white/60 text-sm">
              <li>• End-to-end encryption for data transmission</li>
              <li>• Secure token-based authentication</li>
              <li>• Regular security audits</li>
              <li>• Access controls and role-based permissions</li>
              <li>• 24/7 monitoring for suspicious activities</li>
            </ul>
          </motion.div>

          {/* Data Sharing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <h2 className="text-xl font-semibold mb-4">Data Sharing</h2>
            <p className="text-white/60 text-sm mb-3">We do not sell your personal information. We may share your information only in these circumstances:</p>
            <ul className="space-y-2 text-white/60 text-sm">
              <li>• <span className="text-white/80">Service Providers:</span> Third-party infrastructure providers that host your servers</li>
              <li>• <span className="text-white/80">Payment Processors:</span> Cryptocurrency payment processors</li>
              <li>• <span className="text-white/80">Legal Requirements:</span> When required by law</li>
            </ul>
          </motion.div>

          {/* Cookies */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <FaCookie className="text-white/40" />
              <h2 className="text-xl font-semibold">Cookies</h2>
            </div>
            <p className="text-white/60 text-sm mb-3">We use essential cookies to maintain your login session, remember preferences, and enhance security.</p>
          </motion.div>

          {/* Your Rights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <h2 className="text-xl font-semibold mb-4">Your Rights</h2>
            <p className="text-white/60 text-sm mb-3">You have the right to:</p>
            <ul className="space-y-2 text-white/60 text-sm">
              <li>• Access and correct your personal information</li>
              <li>• Request deletion of your data</li>
              <li>• Export your data</li>
              <li>• Opt-out of marketing communications</li>
            </ul>
          </motion.div>

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="border border-white/10 rounded-lg p-6 bg-white/[0.02]"
          >
            <div className="flex items-center gap-2 mb-3">
              <FaEnvelope className="text-white/40" />
              <h2 className="text-xl font-semibold">Contact Us</h2>
            </div>
            <p className="text-white/60 text-sm mb-4">
              If you have questions about this Privacy Policy, please contact us through our support system.
            </p>
            <Link
              href="/dashboard/support"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors text-sm"
            >
              Contact Support
            </Link>
          </motion.div>
        </div>
      </section>
      </div>

      <Footer />
    </>
  );
}
