# Support Ticket System

A comprehensive support ticket system has been added to the Unhost platform. This allows users to create support tickets and admins to respond to them.

## Database Setup

**Important:** Run the SQL schema to set up the required tables:

```bash
# In your Supabase SQL editor, run:
supabase/tickets_schema.sql
```

This creates:
- `tickets` table - Main ticket records
- `ticket_messages` table - Messages/replies on tickets
- `ticket_attachments` table - Future attachment support
- Proper indexes and RLS policies
- Enums for status, priority, and category

## Features

### For Users

**Access:** `/dashboard/support`

- Create new support tickets with subject, category, and priority
- View all their tickets with status indicators
- Reply to tickets
- Automatic ticket reopening when user replies to resolved/closed tickets
- Real-time status updates

**Ticket Categories:**
- Billing & Payments
- Technical Support
- Account Issues
- Server Problem
- Feature Request
- Other

**Ticket Priorities:**
- Low
- Normal
- High
- Urgent

**Ticket Statuses:**
- Open (blue) - New ticket
- In Progress (yellow) - Admin is working on it
- Waiting for User (orange) - Admin needs response
- Resolved (green) - Issue fixed
- Closed (gray) - Ticket closed

### For Admins

**Access:** `/dashboard/admin?tab=tickets`

- View all tickets from all users
- Filter by status (Open, In Progress, Waiting for User, Resolved, Closed)
- Two-panel interface:
  - Left: List of tickets with quick info
  - Right: Selected ticket details with full conversation
- Reply to tickets (public replies visible to users)
- Add internal notes (only visible to admins, marked with lock icon)
- Update ticket status via dropdown
- Automatic status changes:
  - When admin replies to "Open" ticket → "In Progress"
  - When user replies to "Resolved/Closed" ticket → "Open"

## API Endpoints

### `GET /api/tickets`
List tickets (users see their own, admins see all)
- Query params: `status`, `category`, `priority`

### `POST /api/tickets`
Create a new ticket
- Body: `{ subject, category, priority, message }`

### `GET /api/tickets/[id]`
Get ticket details with messages
- Returns: ticket, messages, isAdmin flag

### `PATCH /api/tickets/[id]`
Update ticket (admin only)
- Body: `{ status, priority, assigned_to }`

### `POST /api/tickets/[id]/messages`
Add a message/reply
- Body: `{ message, is_internal }` (is_internal only for admins)

## Component Structure

```
/app/dashboard/support/
  ├── page.tsx                    # User ticket list & create
  └── [id]/
      └── page.tsx                # User ticket detail & reply

/app/dashboard/admin/
  └── page.tsx                    # Admin panel with tickets tab

/components/admin/
  └── AdminTicketsSection.tsx     # Admin ticket management UI

/app/api/tickets/
  ├── route.ts                    # List & create tickets
  ├── [id]/
  │   ├── route.ts               # Get & update ticket
  │   └── messages/
  │       └── route.ts           # Add messages
```

## UI Features

### User Interface
- Clean card-based design
- Status badges with color coding
- Priority indicators
- Message count
- Timestamp formatting
- Empty state with call-to-action
- Form validation
- Loading states

### Admin Interface
- Split-panel layout for efficiency
- Quick ticket selection
- Status dropdown for fast updates
- Internal notes checkbox
- User email and ticket metadata
- Real-time message threading
- Visual distinction between user/admin messages

## Security

- Row Level Security (RLS) enabled
- Users can only see their own tickets
- Admins use service role key for full access
- Internal notes hidden from users
- Proper authentication checks on all endpoints

## Future Enhancements

Potential improvements:
- File attachments support (table already exists)
- Email notifications on ticket updates
- Auto-close tickets after X days of inactivity
- Ticket assignment to specific admins
- Search functionality
- Ticket templates
- Satisfaction ratings
- SLA tracking
- Export ticket history

## Integration

The support system is fully integrated:
- ✅ Sidebar navigation (Support link)
- ✅ Admin panel tab (Support Tickets)
- ✅ Database schema with RLS
- ✅ API routes with authentication
- ✅ Professional UI/UX
- ✅ Real-time status management
