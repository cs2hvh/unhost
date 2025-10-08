'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/app/provider';
import {
  FaUser,
  FaArrowLeft,
} from 'react-icons/fa';
import Link from 'next/link';

export default function ProfileSettings() {
  const { user } = useAuth();

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
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex items-center space-x-4">
        <Link href="/dashboard/settings">
          <Button variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/10">
            <FaArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-medium text-white">Profile Settings</h1>
          <p className="text-white/60">Manage your account details and security</p>
        </div>
      </motion.div>


      {/* Account Information */}
      <motion.div variants={fadeInUp}>
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <FaUser className="h-5 w-5" />
              <span>Account Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label className="text-white/60 text-sm">Email Address</Label>
                <p className="text-white font-medium mt-1">{user?.email}</p>
              </div>
              <div>
                <Label className="text-white/60 text-sm">Account ID</Label>
                <p className="text-white font-medium mt-1 font-mono text-sm">{user?.id}</p>
              </div>
              <div>
                <Label className="text-white/60 text-sm">Member Since</Label>
                <p className="text-white font-medium mt-1">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}