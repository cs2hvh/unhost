'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FaTicketAlt, FaUser, FaPaperPlane, FaCheckCircle, FaTimesCircle, FaClock, FaInbox, FaExclamationTriangle, FaSync, FaLock, FaBold, FaItalic, FaUnderline, FaListUl, FaListOl, FaCode, FaSearch } from 'react-icons/fa'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { InlineLoader } from '@/components/ui/loader'

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
  updated_at: string
  last_reply_at: string | null
  user: {
    id: string
    email: string
  }
  messages?: { count: number }[]
}

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: FaInbox },
  in_progress: { label: 'In Progress', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: FaClock },
  waiting_user: { label: 'Waiting for User', color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: FaExclamationTriangle },
  resolved: { label: 'Resolved', color: 'text-green-400', bgColor: 'bg-green-500/20', icon: FaCheckCircle },
  closed: { label: 'Closed', color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: FaTimesCircle },
}

const PRIORITY_COLORS = {
  low: 'text-gray-400',
  normal: 'text-blue-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
}

const CATEGORIES = [
  { value: 'billing', label: 'Billing & Payments' },
  { value: 'technical', label: 'Technical Support' },
  { value: 'account', label: 'Account Issues' },
  { value: 'server_issue', label: 'Server Problem' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
]

interface AdminTicketsSectionProps {
  getAccessToken: () => Promise<string | null>
}

export function AdminTicketsSection({ getAccessToken }: AdminTicketsSectionProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTicketNumber, setSearchTicketNumber] = useState('')
  const [searchUserEmail, setSearchUserEmail] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [reply, setReply] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadTickets()
    
    // Auto-refresh tickets every 30 seconds to catch user updates
    const interval = setInterval(() => {
      loadTickets()
      // If a ticket is selected, refresh its messages too
      if (selectedTicket) {
        loadTicketMessages(selectedTicket.id)
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [filterStatus, selectedTicket?.id])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      const url = filterStatus === 'all' 
        ? '/api/tickets' 
        : `/api/tickets?status=${filterStatus}`

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets || [])
        
        // If a ticket is currently selected, update its data
        if (selectedTicket) {
          const updatedTicket = data.tickets?.find((t: Ticket) => t.id === selectedTicket.id)
          if (updatedTicket) {
            setSelectedTicket(updatedTicket)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTicketMessages = async (ticketId: string) => {
    setLoadingMessages(true)
    try {
      const token = await getAccessToken()
      const res = await fetch(`/api/tickets/${ticketId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setReply('')
    setIsInternal(false)
    loadTicketMessages(ticket.id)
  }

  const handleSendReply = async () => {
    if (!selectedTicket || !reply.trim()) return

    setSending(true)
    try {
      const token = await getAccessToken()
      const res = await fetch(`/api/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: reply,
          is_internal: isInternal,
        }),
      })

      if (res.ok) {
        setReply('')
        if (editorRef.current) {
          editorRef.current.innerHTML = ''
        }
        setIsInternal(false)
        loadTicketMessages(selectedTicket.id)
        loadTickets()
        toast.success(isInternal ? 'Internal note added' : 'Reply sent')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to send reply')
      }
    } catch (error) {
      toast.error('Failed to send reply')
    } finally {
      setSending(false)
    }
  }

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTicket) return

    setUpdating(true)
    try {
      const token = await getAccessToken()
      const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      })

      if (res.ok) {
        const data = await res.json()
        setSelectedTicket(data.ticket)
        loadTickets()
        toast.success('Status updated')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update status')
      }
    } catch (error) {
      toast.error('Failed to update status')
    } finally {
      setUpdating(false)
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

  // Text formatting functions
  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  const insertList = (ordered: boolean) => {
    document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList', false)
    editorRef.current?.focus()
  }

  // Filter tickets based on search criteria
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // Status filter
      if (filterStatus !== 'all' && ticket.status !== filterStatus) {
        return false
      }

      // Ticket number filter
      if (searchTicketNumber && !ticket.ticket_number.toString().includes(searchTicketNumber)) {
        return false
      }

      // User email filter
      if (searchUserEmail && !ticket.user.email.toLowerCase().includes(searchUserEmail.toLowerCase())) {
        return false
      }

      // General search in subject
      if (searchQuery && !ticket.subject.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      return true
    })
  }, [tickets, filterStatus, searchQuery, searchTicketNumber, searchUserEmail])

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Tickets List */}
      <div className="col-span-5">
        <Card className="bg-black/50 border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <FaTicketAlt /> Support Tickets
              </CardTitle>
              <Button
                onClick={loadTickets}
                size="sm"
                variant="outline"
                className="bg-white/5 hover:bg-white/10 text-white border-white/20"
                disabled={loading}
              >
                <FaSync className={loading ? 'animate-spin' : ''} />
              </Button>
            </div>
            <div className="space-y-3 mt-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-white/5 text-white border-white/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black text-white border-white/10">
                  <SelectItem value="all">All Tickets</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="waiting_user">Waiting for User</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <div className="space-y-2">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <Input
                    placeholder="Search subject..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white/5 text-white border-white/20 pl-9"
                  />
                </div>
                <Input
                  placeholder="Filter by ticket #..."
                  value={searchTicketNumber}
                  onChange={(e) => setSearchTicketNumber(e.target.value)}
                  className="bg-white/5 text-white border-white/20"
                />
                <Input
                  placeholder="Filter by user email..."
                  value={searchUserEmail}
                  onChange={(e) => setSearchUserEmail(e.target.value)}
                  className="bg-white/5 text-white border-white/20"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8 text-white/60">Loading...</div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-8 text-white/60">No tickets found</div>
              ) : (
                filteredTickets.map((ticket) => {
                  const statusInfo = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG]
                  const StatusIcon = statusInfo.icon
                  const messageCount = getMessageCount(ticket)
                  const isSelected = selectedTicket?.id === ticket.id

                  return (
                    <button
                      key={ticket.id}
                      onClick={() => handleSelectTicket(ticket)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? 'bg-[#60A5FA]/20 border-[#60A5FA]'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-white/60 text-xs font-mono">#{ticket.ticket_number}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${statusInfo.bgColor} ${statusInfo.color}`}>
                          <StatusIcon className="text-xs" />
                          {statusInfo.label}
                        </span>
                      </div>
                      <h4 className="text-white font-medium text-sm mb-1 line-clamp-2">{ticket.subject}</h4>
                      <div className="flex items-center gap-2 text-xs text-white/60">
                        <span>{ticket.user.email}</span>
                        <span>•</span>
                        <span className={PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS]}>
                          {ticket.priority.toUpperCase()}
                        </span>
                        <span>•</span>
                        <span>{messageCount} msg</span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Detail */}
      <div className="col-span-7">
        {selectedTicket ? (
          <div className="space-y-4">
            <Card className="bg-black/50 border-white/10">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-white/60 text-sm font-mono">#{selectedTicket.ticket_number}</span>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${STATUS_CONFIG[selectedTicket.status as keyof typeof STATUS_CONFIG].bgColor} ${STATUS_CONFIG[selectedTicket.status as keyof typeof STATUS_CONFIG].color}`}>
                        {STATUS_CONFIG[selectedTicket.status as keyof typeof STATUS_CONFIG].label}
                      </span>
                      <span className={`text-xs font-semibold ${PRIORITY_COLORS[selectedTicket.priority as keyof typeof PRIORITY_COLORS]}`}>
                        {selectedTicket.priority.toUpperCase()}
                      </span>
                    </div>
                    <CardTitle className="text-white">{selectedTicket.subject}</CardTitle>
                    <p className="text-white/60 text-sm mt-2">
                      By {selectedTicket.user.email} • {CATEGORIES.find(c => c.value === selectedTicket.category)?.label}
                    </p>
                    <p className="text-white/60 text-xs mt-1">Created {formatDate(selectedTicket.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={selectedTicket.status}
                      onValueChange={handleUpdateStatus}
                      disabled={updating}
                    >
                      <SelectTrigger className="bg-white/5 text-white border-white/20 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-black text-white border-white/10">
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="waiting_user">Waiting for User</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Messages */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto px-2">
              {loadingMessages ? (
                <div className="text-center py-8 text-white/60">Loading messages...</div>
              ) : (
                messages.map((msg) => {
                  const isUserMessage = msg.user.id === selectedTicket.user.id

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isUserMessage ? 'justify-start' : 'justify-end'} mb-3`}
                    >
                      <div className={`max-w-[75%] ${isUserMessage ? '' : 'ml-auto'}`}>
                        <Card
                          className={`${
                            isUserMessage
                              ? 'bg-white/5 border-white/10'
                              : 'bg-blue-500/10 border-blue-500/20'
                          } ${msg.is_internal ? 'border-yellow-500/30 bg-yellow-500/5' : ''}`}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full ${isUserMessage ? 'bg-white/10' : 'bg-blue-500/20'} flex items-center justify-center`}>
                                <FaUser className={isUserMessage ? 'text-white/60' : 'text-blue-400'} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-medium text-sm">
                                    {isUserMessage ? msg.user.email : 'Support Team'}
                                  </span>
                                  {msg.is_internal && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                                      <FaLock className="text-xs" /> Internal
                                    </span>
                                  )}
                                </div>
                                <span className="text-white/60 text-xs">{formatDate(msg.created_at)}</span>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div 
                              className="text-white/90 text-sm prose prose-invert max-w-none"
                              dangerouslySetInnerHTML={{ __html: msg.message }}
                            />
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Reply Form */}
            <Card className="bg-black/50 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Reply to Ticket</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Formatting Toolbar */}
                <div className="flex items-center gap-1 p-2 bg-white/5 border border-white/10 rounded-lg flex-wrap">
                  <button
                    type="button"
                    onClick={() => applyFormat('bold')}
                    className="p-2 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white"
                    title="Bold"
                  >
                    <FaBold />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormat('italic')}
                    className="p-2 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white"
                    title="Italic"
                  >
                    <FaItalic />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormat('underline')}
                    className="p-2 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white"
                    title="Underline"
                  >
                    <FaUnderline />
                  </button>
                  <div className="w-px h-6 bg-white/10 mx-1" />
                  <button
                    type="button"
                    onClick={() => insertList(false)}
                    className="p-2 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white"
                    title="Bullet List"
                  >
                    <FaListUl />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertList(true)}
                    className="p-2 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white"
                    title="Numbered List"
                  >
                    <FaListOl />
                  </button>
                  <div className="w-px h-6 bg-white/10 mx-1" />
                  <button
                    type="button"
                    onClick={() => applyFormat('formatBlock', '<pre>')}
                    className="p-2 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white"
                    title="Code Block"
                  >
                    <FaCode />
                  </button>
                </div>

                {/* Rich Text Editor */}
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={(e) => setReply(e.currentTarget.innerHTML)}
                  className="bg-white/5 text-white border border-white/20 rounded-lg p-3 min-h-[120px] max-h-[300px] overflow-y-auto focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 prose prose-invert max-w-none"
                  data-placeholder="Type your reply..."
                  style={{
                    wordBreak: 'break-word',
                  }}
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded"
                    />
                    <FaLock className="text-yellow-400" />
                    Internal Note (hidden from user)
                  </label>
                  <Button
                    onClick={handleSendReply}
                    disabled={sending || !reply.trim()}
                    className="bg-[#60A5FA] hover:bg-[#60A5FA]/80 text-white"
                  >
                    {sending ? <InlineLoader text="Sending" /> : (
                      <>
                        <FaPaperPlane className="mr-2" /> Send Reply
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="bg-black/50 border-white/10">
            <CardContent className="py-12">
              <div className="text-center text-white/60">
                <FaTicketAlt className="mx-auto text-4xl mb-3 opacity-50" />
                <p>Select a ticket to view details and reply</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
