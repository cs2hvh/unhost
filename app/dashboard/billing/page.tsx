'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/hooks/useWallet';
import {
  FaHistory,
  FaArrowUp,
  FaArrowDown,
  FaCheckCircle,
  FaDollarSign,
  FaBolt,
  FaServer
} from 'react-icons/fa';
import AddFundsSection from '@/components/dashboard/billing/AddFundsSection';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'server_payment';
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed';
  timestamp: string;
  description: string;
}

export default function Wallet() {
  const { balance, transactions } = useWallet();
  const [showSuccess, setShowSuccess] = useState(false);

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: "easeOut" }
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={stagger}
      className="space-y-8"
    >
      {/* Wallet Overview */}
      <motion.div variants={fadeInUp}>
        <h1 className="text-2xl font-medium text-white mb-6">Billing & Payments</h1>
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-xl font-medium text-white mb-4">Account Balance</h2>
                <div className="bg-white/5 border border-white/10 p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white/60">Available Balance</span>
                    <span className="text-3xl font-medium text-white">${balance.toFixed(2)}</span>
                  </div>
                  <div className="text-white/50 text-sm">USD Equivalent</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 border border-white/10 p-4 text-center rounded-xl">
                  <FaDollarSign className="h-6 w-6 text-white mx-auto mb-2" />
                  <p className="text-lg font-medium text-white">${balance.toFixed(2)}</p>
                  <p className="text-white/60 text-xs">Available</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 text-center rounded-xl">
                  <FaBolt className="h-6 w-6 text-white mx-auto mb-2" />
                  <p className="text-lg font-medium text-white">$0.00</p>
                  <p className="text-white/60 text-xs">Reserved</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 text-center rounded-xl">
                  <FaHistory className="h-6 w-6 text-white mx-auto mb-2" />
                  <p className="text-lg font-medium text-white">{transactions.length}</p>
                  <p className="text-white/60 text-xs">Transactions</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Funds and History */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Add Funds Section */}
        <AddFundsSection />

        {/* Transaction History */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white text-2xl font-normal flex items-center space-x-3">
              <FaHistory className="h-6 w-6 text-white" />
              <span>Recent Transactions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8">
                <FaHistory className="h-12 w-12 text-white/30 mx-auto mb-4" />
                <p className="text-white/60">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${transaction.type === 'deposit' ? 'bg-green-500/20' :
                        transaction.type === 'server_payment' ? 'bg-blue-500/20' : 'bg-red-500/20'
                        }`}>
                        {transaction.type === 'deposit' ?
                          <FaArrowDown className="h-5 w-5 text-green-400" /> :
                          transaction.type === 'server_payment' ?
                            <FaServer className="h-5 w-5 text-blue-400" /> :
                            <FaArrowUp className="h-5 w-5 text-red-400" />
                        }
                      </div>
                      <div>
                        <p className="text-white font-normal">{transaction.description}</p>
                        <p className="text-white/60 text-sm">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-normal ${transaction.type === 'deposit' ? 'text-green-400' : 'text-red-400'
                        }`}>
                        {transaction.type === 'deposit' ? '+' : '-'}${parseFloat(transaction.amount).toFixed(2)}
                      </p>
                      <Badge variant="secondary" className={`${transaction.status === 'completed' ? 'bg-green-500/20 text-green-200' :
                        transaction.status === 'pending' ? 'bg-yellow-500/20 text-yellow-200' :
                          'bg-red-500/20 text-red-200'
                        }`}>
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>


      {/* Success Message */}
      {showSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-6 right-6 z-50"
        >
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center space-x-2">
            <FaCheckCircle className="h-5 w-5" />
            <span>Success!</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
