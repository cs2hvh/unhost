'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FaTicketAlt, FaPlus, FaInbox, FaClock, FaCheckCircle, FaTimesCircle, FaSpinner, FaExclamationTriangle } from 'react-icons/fa'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Loader, InlineLoader } from '@/components/ui/loader'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

type Ticket = {
  id: string
  ticket_number: number
  subject: string
  category: string
  priority: string
  status: string
  created_at: string
  updated_at: string
  last_reply_at: string | null
  messages?: { count: number }[]
}

const CATEGORIES = [
  { value: 'billing', label: 'Billing & Payments' },
  { value: 'technical', label: 'Technical Support' },
  { value: 'account', label: 'Account Issues' },
  { value: 'server_issue', label: 'Server Problem' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: FaInbox },
  in_progress: { label: 'In Progress', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: FaClock },
  waiting_user: { label: 'Waiting for You', color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: FaExclamationTriangle },
  resolved: { label: 'Resolved', color: 'text-green-400', bgColor: 'bg-green-500/20', icon: FaCheckCircle },
  closed: { label: 'Closed', color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: FaTimesCircle },
}

const PRIORITY_COLORS = {
  low: 'text-gray-400',
  normal: 'text-blue-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
}

export default function SupportPage() {
  const { user } = useUser()
  const [view, setView] = useState<'list' | 'create'>('list')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('technical')
  const [priority, setPriority] = useState('normal')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (user) {
      loadTickets()
    }
  }, [user])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      const res = await fetch('/api/tickets', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      })

      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets || [])
      }
    } catch (error) {
      console.error('Failed to load tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!subject.trim() || !message.trim()) {
      toast.error('Subject and message are required')
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          subject,
          category,
          priority,
          message,
        }),
      })

      if (res.ok) {
        toast.success('Ticket created successfully!')
        setSubject('')
        setMessage('')
        setCategory('technical')
        setPriority('normal')
        setView('list')
        loadTickets()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create ticket')
      }
    } catch (error) {
      toast.error('Failed to create ticket')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getMessageCount = (ticket: Ticket) => {
    return ticket.messages?.[0]?.count || 0
  }

  return (
    <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FaTicketAlt className="text-[#60A5FA]" />
            Support Tickets
          </h1>
          <p className="text-white/60 mt-1">Get help from our support team</p>
        </div>
        <Button
          onClick={() => setView(view === 'list' ? 'create' : 'list')}
          className="bg-[#60A5FA] hover:bg-[#60A5FA]/80 text-white"
        >
          {view === 'list' ? (
            <>
              <FaPlus className="mr-2" /> New Ticket
            </>
          ) : (
            <>View Tickets</>
          )}
        </Button>
      </div>

      {view === 'create' && (
        <Card className="bg-black/50 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Create New Ticket</CardTitle>
            <CardDescription className="text-white/60">
              Describe your issue and our support team will get back to you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-white">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  className="bg-white/5 text-white border-white/20 mt-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="bg-white/5 text-white border-white/20 mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black text-white border-white/10">
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-white">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="bg-white/5 text-white border-white/20 mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black text-white border-white/10">
                      {PRIORITIES.map((pri) => (
                        <SelectItem key={pri.value} value={pri.value}>
                          {pri.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-white">Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Provide detailed information about your issue..."
                  className="bg-white/5 text-white border-white/20 mt-2 min-h-[200px]"
                  required
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#60A5FA] hover:bg-[#60A5FA]/80 text-white"
                >
                  {submitting ? <InlineLoader text="Creating" /> : 'Create Ticket'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setView('list')}
                  variant="outline"
                  className="bg-white/5 hover:bg-white/10 text-white border-white/20"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {view === 'list' && (
        <Card className="bg-black/50 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Your Tickets</CardTitle>
            <CardDescription className="text-white/60">
              View and manage your support requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12">
                <FaTicketAlt className="mx-auto text-white/20 text-5xl mb-4" />
                <p className="text-white/60 mb-4">No tickets yet</p>
                <Button
                  onClick={() => setView('create')}
                  className="bg-[#60A5FA] hover:bg-[#60A5FA]/80 text-white"
                >
                  <FaPlus className="mr-2" /> Create Your First Ticket
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => {
                  const statusInfo = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG]
                  const StatusIcon = statusInfo.icon
                  const messageCount = getMessageCount(ticket)

                  return (
                    <Link key={ticket.id} href={`/dashboard/support/${ticket.id}`}>
                      <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-white/60 text-sm font-mono">
                                #{ticket.ticket_number}
                              </span>
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${statusInfo.bgColor} ${statusInfo.color}`}>
                                <StatusIcon className="text-xs" />
                                {statusInfo.label}
                              </span>
                              <span className={`text-xs ${PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS]}`}>
                                {ticket.priority.toUpperCase()}
                              </span>
                            </div>
                            <h3 className="text-white font-medium mb-1">{ticket.subject}</h3>
                            <div className="flex items-center gap-4 text-xs text-white/60">
                              <span>{CATEGORIES.find(c => c.value === ticket.category)?.label}</span>
                              <span>•</span>
                              <span>{messageCount} {messageCount === 1 ? 'message' : 'messages'}</span>
                              <span>•</span>
                              <span>Created {formatDate(ticket.created_at)}</span>
                              {ticket.last_reply_at && (
                                <>
                                  <span>•</span>
                                  <span>Last reply {formatDate(ticket.last_reply_at)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
