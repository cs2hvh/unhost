import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/tickets/[id] - Get ticket details with messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Get ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .single()

    if (ticketError) {
      return NextResponse.json({ error: ticketError.message }, { status: 500 })
    }

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Check if user has access to this ticket
    if (!isAdmin && ticket.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user data for ticket owner
    const { data: { user: ticketOwner } } = await supabase.auth.admin.getUserById(ticket.user_id)

    // Get messages (filter internal notes for non-admins)
    let messagesQuery = supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })

    // Non-admins cannot see internal messages
    if (!isAdmin) {
      messagesQuery = messagesQuery.eq('is_internal', false)
    }

    const { data: rawMessages, error: messagesError } = await messagesQuery

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
    }

    // Add user data to each message
    const messages = await Promise.all(
      (rawMessages || []).map(async (msg) => {
        const { data: { user: msgUser } } = await supabase.auth.admin.getUserById(msg.user_id)
        
        return {
          ...msg,
          user: { 
            id: msg.user_id, 
            email: msgUser?.email || 'Unknown' 
          }
        }
      })
    )

    return NextResponse.json({
      ticket: {
        ...ticket,
        user: { 
          id: ticket.user_id, 
          email: ticketOwner?.email || 'Unknown' 
        }
      },
      messages,
      isAdmin,
    })
  } catch (error) {
    console.error('Error in GET /api/tickets/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/tickets/[id] - Update ticket (status, priority, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const { status, priority, assigned_to } = body

    // Check ticket exists and user has access
    const { data: ticket } = await supabase
      .from('tickets')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (!isAdmin && ticket.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates: any = {}

    // Admins can update all fields
    if (isAdmin) {
      if (status) updates.status = status
      if (priority) updates.priority = priority
      if (assigned_to !== undefined) updates.assigned_to = assigned_to

      // If closing, set closed_at and closed_by
      if (status === 'closed' || status === 'resolved') {
        updates.closed_at = new Date().toISOString()
        updates.closed_by = user.id
      }
    } else {
      // Users can only open or close their own tickets
      if (status && ticket.user_id === user.id) {
        if (status === 'open') {
          updates.status = 'open'
          updates.closed_at = null
          updates.closed_by = null
        } else if (status === 'closed') {
          updates.status = 'closed'
          updates.closed_at = new Date().toISOString()
          updates.closed_by = user.id
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const { data: updatedTicket, error } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ticket: updatedTicket })
  } catch (error) {
    console.error('Error in PATCH /api/tickets/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
