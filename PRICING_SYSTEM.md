# Server Pricing Management System

## Overview
Created a complete admin-controlled pricing management system that replaces static hardcoded server prices with dynamic database-driven pricing.

## Components Created

### 1. Database Schema (`supabase/pricing_schema.sql`)
- **Table**: `server_pricing`
  - `id` (uuid, primary key)
  - `plan_id` (text, unique) - Linode plan identifier
  - `plan_category` (text) - shared, dedicated, high_memory, premium, gpu
  - `plan_name` (text) - Display name
  - `hourly_price` (decimal 10,4) - Price per hour
  - `monthly_price` (decimal 10,2) - Monthly price
  - `is_active` (boolean) - Enable/disable plans
  - Timestamps: `created_at`, `updated_at`

- **Indexes**: plan_id, category, active status
- **RLS Policy**: Public can view active pricing
- **Default Data**: 18 pre-populated plans across 4 categories

### 2. API Endpoint (`app/api/admin/pricing/route.ts`)
RESTful API with admin authentication:

- **GET** `/api/admin/pricing`
  - Lists all pricing entries
  - Ordered by category and price
  - Returns: `{ ok: true, pricing: [] }`

- **PUT** `/api/admin/pricing`
  - Updates existing pricing entry
  - Body: `{ id, hourly_price?, monthly_price?, is_active? }`
  - Returns: `{ ok: true, pricing: {...} }`

- **POST** `/api/admin/pricing`
  - Creates new pricing entry
  - Body: `{ plan_id, plan_category, plan_name, hourly_price, monthly_price, is_active? }`
  - Returns: `{ ok: true, pricing: {...} }`

### 3. Admin UI Component (`components/admin/PricingSection.tsx`)
Simplified pricing management showing all Linode plans:

**Features:**
- Displays ALL Linode plans automatically from `LINODE_PLAN_TYPES`
- Shows Linode default pricing alongside your custom pricing
- Inline editing for hourly/monthly prices only
- Category-based grouping (Shared, Dedicated, High Memory, Premium, GPU)
- Green highlighting for plans with custom pricing
- Reset button to revert to Linode defaults
- No need to manually add plans - they're all there from Linode

**UI Elements:**
- Grouped by category with color-coded badges
- Table showing: Plan ID, Specs, Linode Price, Your Price
- Inline number inputs for editing prices
- Save/Cancel buttons per row
- Reset button for custom-priced plans
- Clean white/neutral styling

### 4. Database Pricing Utility (`lib/pricingDb.ts`)
Caching layer for database pricing:

```typescript
fetchPricing(): Promise<Map<string, PricingEntry>>
getPlanPricing(planId: string): Promise<{ hourly, monthly } | null>
clearPricingCache(): void
```

**Features:**
- 1-minute cache duration
- Automatic cache invalidation
- Fast map-based lookups
- Error handling with fallback

### 5. Updated Pricing Library (`lib/pricing.ts`)
Converted to async/await pattern:

**Functions (all now async):**
- `calculateHourlyCost()` - Fetches from DB, falls back to static
- `calculateMonthlyCost()` - Uses DB pricing when available
- `calculateCostForDuration()` - Async cost calculation
- `getEstimatedRuntime()` - Async runtime estimation
- `canAffordServer()` - Async affordability check

**Flow:**
1. Try to get pricing from database via `getPlanPricing()`
2. If not found, fall back to static `LINODE_PLAN_TYPES`
3. Apply location multipliers
4. Return calculated values

### 6. Server Creation Page Updates (`app/dashboard/servers/page.tsx`)
Converted from useMemo to async state:

**Changes:**
- Added state: `pricing`, `canAfford`, `estimatedRuntime`
- Added `useEffect` hook to calculate pricing asynchronously
- Removed synchronous useMemo calculations
- Pricing updates when plan, location, or balance changes

### 7. Admin Panel Integration (`app/dashboard/admin/page.tsx`)
Added "Pricing" tab to admin panel:

**Updates:**
- Added `PricingSection` import
- Added 'pricing' to `TabKey` type
- Added "Pricing" tab to TABS array
- Added pricing tab content rendering

## Database Migration

To apply the pricing schema, run this SQL in your Supabase SQL Editor:

```sql
-- Copy the contents of supabase/pricing_schema.sql
```

Or connect via psql:
```bash
psql <your-connection-string> -f supabase/pricing_schema.sql
```

## Usage

### For Admins:
1. Go to Admin Panel → Pricing tab
2. All Linode plans are automatically displayed, grouped by category
3. View Linode's default pricing vs your custom pricing side-by-side
4. Click the edit icon on any plan to modify hourly/monthly prices
5. Click save to update pricing (updates immediately in database)
6. Plans with custom pricing are highlighted in green
7. Click "Reset" to revert any plan back to Linode's default pricing
8. No need to add plans manually - all Linode plans are always shown

### For Pricing System:
- Server creation automatically uses your custom pricing when available
- Falls back to Linode default prices if no custom pricing set
- Prices cached for 1 minute for performance
- All cost calculations now async
- Users see your custom prices during server creation

## Default Pricing Included

The schema includes 18 default pricing entries, but **the admin UI shows ALL Linode plans** from your `LINODE_PLAN_TYPES` configuration (typically 30+ plans across all categories).

**How it works:**
- Admin UI displays every plan from Linode automatically
- Plans without custom pricing show Linode's default prices
- Edit any plan to set custom pricing (stored in database)
- Custom-priced plans are highlighted in green
- Reset button removes custom pricing, reverting to Linode defaults

**Categories shown:**
- **Shared CPU**: All g6-standard plans
- **Dedicated CPU**: All g6-dedicated plans  
- **High Memory**: All g7-highmem plans
- **Premium**: All g6-premium plans
- **GPU** (if available): GPU-enabled plans

No manual plan addition needed - just edit the prices!

## Benefits

1. **Admin Control**: No code changes needed to adjust pricing
2. **Flexibility**: Easy to add/remove/modify plans
3. **Performance**: 1-minute caching reduces database queries
4. **Reliability**: Falls back to static pricing if database unavailable
5. **User Experience**: Real-time pricing updates in UI
6. **Audit Trail**: Timestamps track pricing changes
7. **Plan Management**: Enable/disable plans without deletion

## Next Steps

1. Run the database migration
2. Test admin pricing updates
3. Verify server creation uses new pricing
4. Consider adding pricing history/audit log if needed
5. Add pricing change notifications if desired
