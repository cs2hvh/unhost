import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/tickets - List tickets (users see their own, admins see all)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const category = url.searchParams.get('category')
    const priority = url.searchParams.get('priority')

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isAdmin = roleData?.role === 'admin'

    let query = supabase
      .from('tickets')
      .select('*')
      .order('updated_at', { ascending: false })

    // Non-admins only see their own tickets
    if (!isAdmin) {
      query = query.eq('user_id', user.id)
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (category) {
      query = query.eq('category', category)
    }
    if (priority) {
      query = query.eq('priority', priority)
    }

    const { data: tickets, error } = await query

    if (error) {
      console.error('Error fetching tickets:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Manually fetch user data and message counts for each ticket
    const ticketsWithData = await Promise.all(
      (tickets || []).map(async (ticket) => {
        // Get user email from auth
        const { data: { user: ticketOwner } } = await supabase.auth.admin.getUserById(ticket.user_id)
        
        // Get message count
        const { count } = await supabase
          .from('ticket_messages')
          .select('*', { count: 'exact', head: true })
          .eq('ticket_id', ticket.id)

        return {
          ...ticket,
          user: { 
            id: ticket.user_id, 
            email: ticketOwner?.email || 'Unknown' 
          },
          messages: [{ count: count || 0 }]
        }
      })
    )

    return NextResponse.json({ tickets: ticketsWithData })
  } catch (error) {
    console.error('Error in GET /api/tickets:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tickets - Create a new ticket
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { subject, category, priority, message } = body

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
    }

    // Create the ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        user_id: user.id,
        subject,
        category: category || 'other',
        priority: priority || 'normal',
        status: 'open',
      })
      .select()
      .single()

    if (ticketError) {
      console.error('Error creating ticket:', ticketError)
      return NextResponse.json({ error: ticketError.message }, { status: 500 })
    }

    // Create the initial message
    const { error: messageError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticket.id,
        user_id: user.id,
        message,
      })

    if (messageError) {
      console.error('Error creating message:', messageError)
      // Don't fail the whole request if message creation fails
    }

    return NextResponse.json({ ticket })
  } catch (error) {
    console.error('Error in POST /api/tickets:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
