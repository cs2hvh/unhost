'use client'

import { useState, useEffect, use } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FaArrowLeft, FaUser, FaPaperPlane, FaCheckCircle, FaTimesCircle, FaClock, FaInbox, FaExclamationTriangle, FaLock } from 'react-icons/fa'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Loader, InlineLoader } from '@/components/ui/loader'
import { useRouter } from 'next/navigation'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

type Message = {
  id: string
  message: string
  is_internal: boolean
  created_at: string
  user: {
    id: string
    email: string
  }
}

type Ticket = {
  id: string
  ticket_number: number
  subject: string
  category: string
  priority: string
  status: string
  created_at: string
  user: {
    id: string
    email: string
  }
}

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: FaInbox },
  in_progress: { label: 'In Progress', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: FaClock },
  waiting_user: { label: 'Waiting for You', color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: FaExclamationTriangle },
  resolved: { label: 'Resolved', color: 'text-green-400', bgColor: 'bg-green-500/20', icon: FaCheckCircle },
  closed: { label: 'Closed', color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: FaTimesCircle },
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const ticketId = resolvedParams.id
  const { user } = useUser()
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (user && ticketId) {
      loadTicket()
    }
  }, [user, ticketId])

  const loadTicket = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      const res = await fetch(`/api/tickets/${ticketId}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      })

      if (res.ok) {
        const data = await res.json()
        setTicket(data.ticket)
        setMessages(data.messages || [])
        setIsAdmin(data.isAdmin || false)
      } else if (res.status === 404) {
        toast.error('Ticket not found')
        router.push('/dashboard/support')
      } else if (res.status === 403) {
        toast.error('Access denied')
        router.push('/dashboard/support')
      }
    } catch (error) {
      console.error('Failed to load ticket:', error)
      toast.error('Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim()) {
      toast.error('Message cannot be empty')
      return
    }

    setSending(true)
    try {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      const res = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          message: newMessage,
        }),
      })

      if (res.ok) {
        setNewMessage('')
        loadTicket()
        toast.success('Message sent')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to send message')
      }
    } catch (error) {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return

    setUpdatingStatus(true)
    try {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        toast.success('Ticket status updated')
        loadTicket()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update status')
      }
    } catch (error) {
      toast.error('Failed to update status')
    } finally {
      setUpdatingStatus(false)
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader />
      </div>
    )
  }

  if (!ticket) {
    return null
  }

  const statusInfo = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG]
  const StatusIcon = statusInfo.icon
  const canReply = ticket.status !== 'closed'

  return (
    <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/support">
          <Button variant="outline" className="bg-white/5 hover:bg-white/10 text-white border-white/20">
            <FaArrowLeft className="mr-2" /> Back to Tickets
          </Button>
        </Link>
      </div>

      <Card className="bg-black/50 border-white/10">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-white/60 text-sm font-mono">#{ticket.ticket_number}</span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${statusInfo.bgColor} ${statusInfo.color}`}>
                  <StatusIcon className="text-xs" />
                  {statusInfo.label}
                </span>
              </div>
              <CardTitle className="text-white text-2xl">{ticket.subject}</CardTitle>
              <CardDescription className="text-white/60 mt-2">
                Created {formatDate(ticket.created_at)} by {ticket.user.email}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2">
              <Select value={ticket.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
                <SelectTrigger className="bg-white/5 text-white border-white/20 w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black text-white border-white/10">
                  {!isAdmin ? (
                    <>
                      <SelectItem value="open">Reopen Ticket</SelectItem>
                      <SelectItem value="closed">Close Ticket</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="waiting_user">Waiting for User</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {updatingStatus && <InlineLoader text="Updating" />}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {messages.map((msg, idx) => {
          const isUserMessage = msg.user.id === user?.id
          const isAdminMessage = !isUserMessage

          return (
            <Card
              key={msg.id}
              className={`${
                isAdminMessage
                  ? 'bg-blue-500/10 border-blue-500/20'
                  : 'bg-white/5 border-white/10'
              } ${msg.is_internal ? 'border-yellow-500/30 bg-yellow-500/5' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${isAdminMessage ? 'bg-blue-500/20' : 'bg-white/10'} flex items-center justify-center`}>
                    <FaUser className={isAdminMessage ? 'text-blue-400' : 'text-white/60'} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">
                        {isAdminMessage ? 'Support Team' : 'You'}
                      </span>
                      {msg.is_internal && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                          <FaLock className="text-xs" /> Internal Note
                        </span>
                      )}
                    </div>
                    <span className="text-white/60 text-xs">{formatDate(msg.created_at)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-white/90 whitespace-pre-wrap">{msg.message}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {canReply ? (
        <Card className="bg-black/50 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Reply</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendMessage} className="space-y-4">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="bg-white/5 text-white border-white/20 min-h-[150px]"
                disabled={sending}
              />
              <Button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="bg-[#60A5FA] hover:bg-[#60A5FA]/80 text-white"
              >
                {sending ? <InlineLoader text="Sending" /> : (
                  <>
                    <FaPaperPlane className="mr-2" /> Send Message
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gray-500/10 border-gray-500/20">
          <CardContent className="py-4">
            <p className="text-white/60 text-center">
              <FaTimesCircle className="inline mr-2" />
              This ticket is closed. Contact support if you need to reopen it.
            </p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
