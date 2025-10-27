import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/tickets/[id]/messages - Add a message/reply to a ticket
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isAdmin = roleData?.role === 'admin'

    const body = await req.json()
    const { message, is_internal } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Check ticket exists and user has access
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, user_id, status')
      .eq('id', ticketId)
      .single()

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (!isAdmin && ticket.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only admins can create internal messages
    const isInternalNote = isAdmin && is_internal === true

    // Create the message
    const { data: newMessage, error: messageError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        user_id: user.id,
        message: message.trim(),
        is_internal: isInternalNote,
      })
      .select('*')
      .single()

    if (messageError) {
      console.error('Error creating message:', messageError)
      return NextResponse.json({ error: messageError.message }, { status: 500 })
    }

    // Get user data for the message
    const { data: { user: msgUser } } = await supabase.auth.admin.getUserById(user.id)

    // Update ticket status if needed
    if (!isInternalNote) {
      const statusUpdate: any = {
        last_reply_at: new Date().toISOString(),
        last_reply_by: user.id,
      }

      // If user replies to a resolved/closed ticket, reopen it
      if (!isAdmin && (ticket.status === 'resolved' || ticket.status === 'closed')) {
        statusUpdate.status = 'open'
        statusUpdate.closed_at = null
        statusUpdate.closed_by = null
      }
      
      // If admin replies, set status to in_progress if it was open
      if (isAdmin && ticket.status === 'open') {
        statusUpdate.status = 'in_progress'
      }

      await supabase
        .from('tickets')
        .update(statusUpdate)
        .eq('id', ticketId)
    }

    return NextResponse.json({ 
      message: {
        ...newMessage,
        user: { 
          id: user.id, 
          email: msgUser?.email || user.email || 'Unknown' 
        }
      }
    })
  } catch (error) {
    console.error('Error in POST /api/tickets/[id]/messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
