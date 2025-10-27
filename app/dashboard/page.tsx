'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FaServer, FaWallet, FaTicketAlt, FaPlus, FaList, FaChartLine } from 'react-icons/fa'
import Link from 'next/link'
import { useUser } from '@/hooks/useUser'
import { useWallet } from '@/hooks/useWallet'
import { formatCurrency } from '@/lib/pricing'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

export default function DashboardPage() {
  const { user } = useUser()
  const { balance } = useWallet()

  return (
    <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-6">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-white/60">Welcome back, {user?.email?.split('@')[0] || 'User'}</p>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-r from-[#60A5FA]/20 to-[#3B82F6]/10 border-[#60A5FA]/30">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm mb-1">Account Balance</p>
              <p className="text-4xl font-bold text-white">{formatCurrency(balance)}</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#60A5FA]/20 flex items-center justify-center">
              <FaWallet className="text-3xl text-[#60A5FA]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Deploy Server */}
        <Card className="bg-black/50 border-white/10 hover:border-white/20 transition-all duration-300 group">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
              <FaPlus className="text-2xl text-white/80" />
            </div>
            <CardTitle className="text-white">Deploy New Server</CardTitle>
            <CardDescription className="text-white/60">
              Create and provision a new VPS instance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/servers?view=create">
              <Button className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10">
                <FaServer className="mr-2" />
                Create Server
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* View Servers */}
        <Card className="bg-black/50 border-white/10 hover:border-white/20 transition-all duration-300 group">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
              <FaList className="text-2xl text-white/80" />
            </div>
            <CardTitle className="text-white">My Servers</CardTitle>
            <CardDescription className="text-white/60">
              View and manage your existing servers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/servers?view=list">
              <Button className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10">
                <FaServer className="mr-2" />
                View Servers
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Support Tickets */}
        <Card className="bg-black/50 border-white/10 hover:border-white/20 transition-all duration-300 group">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
              <FaTicketAlt className="text-2xl text-white/80" />
            </div>
            <CardTitle className="text-white">Support Tickets</CardTitle>
            <CardDescription className="text-white/60">
              Get help from our support team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/support">
              <Button className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10">
                <FaTicketAlt className="mr-2" />
                View Tickets
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Billing */}
        <Card className="bg-black/50 border-white/10 hover:border-white/20 transition-all duration-300 group">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
              <FaWallet className="text-2xl text-white/80" />
            </div>
            <CardTitle className="text-white">Billing</CardTitle>
            <CardDescription className="text-white/60">
              Manage payments and view usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/billing">
              <Button className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10">
                <FaWallet className="mr-2" />
                Manage Billing
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Add Balance */}
        <Card className="bg-black/50 border-white/10 hover:border-white/20 transition-all duration-300 group">
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
              <FaChartLine className="text-2xl text-white/80" />
            </div>
            <CardTitle className="text-white">Add Balance</CardTitle>
            <CardDescription className="text-white/60">
              Top up your account with cryptocurrency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/billing?action=deposit">
              <Button className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10">
                <FaPlus className="mr-2" />
                Add Funds
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card className="bg-black/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Quick Stats</CardTitle>
          <CardDescription className="text-white/60">Overview of your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-white/60 text-sm mb-2">Account Balance</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(balance)}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-white/60 text-sm mb-2">Active Servers</p>
              <p className="text-2xl font-bold text-white">-</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-white/60 text-sm mb-2">Open Tickets</p>
              <p className="text-2xl font-bold text-white">-</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
