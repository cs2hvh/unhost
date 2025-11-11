# CPU-Based Plan Naming System

## Overview

This feature adds a CPU-based naming and grouping system for server plans. Instead of showing generic categories like "Shared CPU" or "Dedicated CPU", the system now displays actual processor names (e.g., "Intel Xeon 2334S") that can be managed through the admin panel.

## Features

### 1. **Dynamic CPU Names**
- All server plans are now grouped by CPU processor type
- Default CPU names:
  - **Shared CPU**: Intel Xeon 2334S
  - **Dedicated CPU**: Intel Xeon 4343
  - **High Memory**: Intel Xeon 5644
  - **Premium**: Intel Xeon 5644
  - **Storage Optimized**: Intel Xeon 5644

### 2. **Admin Management**
- CPU names can be changed through the admin panel
- Changes are saved in the database and apply immediately
- CPU descriptions can be added for internal reference
- Grouped display in pricing section

### 3. **User-Facing Display**
- Server creation page shows CPU names prominently
- Plans grouped by processor type
- Clear visual distinction between different CPUs

---

## Database Schema

### New Table: `cpu_types`

```sql
CREATE TABLE public.cpu_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_category TEXT NOT NULL UNIQUE, -- shared, dedicated, highmem, premium, storage
  cpu_name TEXT NOT NULL, -- e.g., "Intel Xeon 2334S"
  cpu_description TEXT, -- Optional description
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Column Addition: `server_pricing.cpu_category`

```sql
ALTER TABLE public.server_pricing
  ADD COLUMN cpu_category TEXT REFERENCES public.cpu_types(plan_category);
```

---

## Installation

### 1. Run Database Migration

Execute the SQL schema in your Supabase SQL editor:

```bash
# In Supabase dashboard -> SQL Editor
supabase/cpu_types_schema.sql
```

This will:
- Create the `cpu_types` table
- Add default CPU types (5 categories)
- Set up RLS policies
- Add the `cpu_category` column to `server_pricing`

### 2. Verify Installation

Check that the table was created:

```sql
SELECT * FROM public.cpu_types;
```

You should see 5 rows with default CPU names.

---

## API Endpoints

### `GET /api/admin/cpu-types`
**Description**: List all CPU types  
**Authorization**: Admin only  
**Response**:
```json
{
  "ok": true,
  "cpuTypes": [
    {
      "id": "uuid",
      "plan_category": "shared",
      "cpu_name": "Intel Xeon 2334S",
      "cpu_description": "Shared CPU instances...",
      "created_at": "2025-11-11T...",
      "updated_at": "2025-11-11T..."
    }
  ]
}
```

### `PUT /api/admin/cpu-types`
**Description**: Update a CPU type  
**Authorization**: Admin only  
**Body**:
```json
{
  "plan_category": "shared",
  "cpu_name": "Intel Xeon E5-2690",
  "cpu_description": "Optional description"
}
```
**Response**:
```json
{
  "ok": true,
  "cpuType": { /* updated CPU type */ }
}
```

### `POST /api/admin/cpu-types`
**Description**: Create a new CPU type  
**Authorization**: Admin only  
**Body**:
```json
{
  "plan_category": "gpu",
  "cpu_name": "AMD EPYC 7763",
  "cpu_description": "GPU-enabled instances"
}
```

---

## Admin Panel Usage

### Accessing CPU Management

1. Go to **Admin Panel** (`/dashboard/admin`)
2. Click on the **"CPU Types"** tab
3. You'll see all available CPU categories

### Editing CPU Names

1. Click the **"Edit"** button on any CPU type
2. Modify the **CPU Processor Name** (e.g., "Intel Xeon 2334S")
3. Optionally add a **Description**
4. Click **"Save"** to apply changes
5. Changes are reflected immediately across the platform

### Viewing in Pricing Section

1. Go to **Admin Panel** → **"Pricing"** tab
2. Plans are now **grouped by CPU processor type**
3. Each CPU group shows:
   - CPU name (e.g., "Intel Xeon 2334S")
   - Number of plans
   - Category breakdown (Shared, Dedicated, etc.)

---

## User Experience

### Server Creation Flow

When users create a server (`/dashboard/servers`):

#### Step 1: Select CPU Type
- Users see CPU cards with processor names
- Visual cards showing:
  - **CPU Name**: "Intel Xeon 2334S"
  - **Category**: "Shared CPU"
  - **CPU Icon**

#### Step 2: Select Plan
- Header shows: "Select Plan • Intel Xeon 2334S"
- Plans table displays specs and pricing
- All plans share the same CPU processor

---

## Code Structure

### Files Created

```
supabase/
  └── cpu_types_schema.sql          # Database schema

app/api/admin/cpu-types/
  └── route.ts                       # API endpoints (GET, PUT, POST)

lib/
  └── cpuTypes.ts                    # CPU utilities & caching

components/admin/
  └── CPUTypesSection.tsx            # Admin UI for CPU management
```

### Files Modified

```
lib/linode.ts                        # Added CPU info to LINODE_PLAN_CATEGORIES
components/admin/PricingSection.tsx  # Grouped plans by CPU
app/dashboard/admin/page.tsx         # Added CPU Types tab
app/dashboard/servers/page.tsx       # Display CPU names in creation flow
```

---

## Caching

### CPU Types Cache

- **Cache Duration**: 5 minutes
- **Location**: In-memory Map in `lib/cpuTypes.ts`
- **Auto-invalidation**: After 5 minutes
- **Fallback**: Uses default CPU names from `LINODE_PLAN_CATEGORIES`

**Cache Functions**:
```typescript
fetchCPUTypes()        // Fetch with caching
getCPUName(category)   // Get CPU name for category
clearCPUTypesCache()   // Manually clear cache
```

---

## Customization

### Adding New CPU Categories

1. **Add to database**:
```sql
INSERT INTO public.cpu_types (plan_category, cpu_name)
VALUES ('custom_category', 'AMD Ryzen 9 7950X');
```

2. **Update `lib/linode.ts`**:
```typescript
export const LINODE_PLAN_CATEGORIES = {
  // ...existing categories
  'custom_category': { 
    label: 'Custom Category', 
    defaultCpu: 'AMD Ryzen 9 7950X' 
  },
};
```

3. **Add plans** with the new category in `LINODE_PLAN_TYPES`

### Changing Default CPU Names

Edit `supabase/cpu_types_schema.sql` before running migration:

```sql
INSERT INTO public.cpu_types (plan_category, cpu_name)
VALUES
  ('shared', 'Your Custom CPU Name'),
  ('dedicated', 'Another CPU Name'),
  -- ...
```

---

## Security

### Row Level Security (RLS)

**Public Read Policy**:
```sql
-- Anyone can view CPU types
CREATE POLICY "Allow public read access to cpu_types"
  ON public.cpu_types FOR SELECT
  TO public USING (true);
```

**Authenticated Write Policy**:
```sql
-- Only authenticated users can modify (admin check in API)
CREATE POLICY "Allow authenticated write access to cpu_types"
  ON public.cpu_types FOR ALL
  TO authenticated USING (true);
```

### API Authorization

All write operations (`PUT`, `POST`) check:
1. User is authenticated
2. User email is in `ADMIN_EMAILS` environment variable

---

## Benefits

### For Admins
✅ **Flexibility**: Change CPU names without code changes  
✅ **Branding**: Use custom processor names  
✅ **Clarity**: Group plans by actual hardware  
✅ **Real-time**: Changes apply immediately  

### For Users
✅ **Transparency**: See actual CPU processors  
✅ **Better Selection**: Choose based on hardware, not just specs  
✅ **Professional**: More informative than generic categories  
✅ **Trust**: Clear hardware specifications  

---

## Troubleshooting

### CPU Names Not Showing

**Issue**: CPU names show as "Unknown CPU"  
**Solution**:
1. Check database migration ran successfully
2. Verify `cpu_types` table exists and has data
3. Check browser console for API errors
4. Verify `ADMIN_EMAILS` is set for admin access

### Changes Not Reflecting

**Issue**: Updated CPU names don't appear  
**Solution**:
1. Wait 5 minutes for cache to expire, or
2. Clear CPU cache (restart server), or
3. Hard refresh browser (Ctrl+Shift+R)

### Database Errors

**Issue**: Error inserting/updating CPU types  
**Solution**:
1. Check RLS policies are created
2. Verify user has authenticated session
3. Check `plan_category` is unique
4. Ensure foreign key constraints are valid

---

## Future Enhancements

Potential improvements:
- **CPU Specifications**: Add clock speed, cores, threads
- **Benchmarks**: Link to performance data
- **Logos**: Upload CPU manufacturer logos
- **Comparison**: Side-by-side CPU comparison tool
- **History**: Track CPU name changes
- **Multiple CPUs**: Support plans with mixed CPUs
- **API Public Access**: Let users query CPU info via API

---

## Migration Guide

### From Previous System

If upgrading from the old category-based system:

1. **Backup database**:
```bash
pg_dump your_database > backup.sql
```

2. **Run migration**:
```sql
-- Run supabase/cpu_types_schema.sql
```

3. **Verify data**:
```sql
SELECT * FROM cpu_types;
SELECT plan_id, cpu_category FROM server_pricing LIMIT 10;
```

4. **Test changes**:
   - Admin panel → CPU Types tab
   - Admin panel → Pricing tab (check grouping)
   - Server creation page (check CPU display)

5. **Rollback if needed**:
```sql
DROP TABLE IF EXISTS cpu_types CASCADE;
ALTER TABLE server_pricing DROP COLUMN IF EXISTS cpu_category;
```

---

## Summary

This feature adds a professional, hardware-focused presentation of server plans:

- **Admin-controlled** CPU processor names
- **Database-driven** with caching for performance
- **User-friendly** display in server creation
- **Grouped pricing** by CPU type in admin panel
- **Fully integrated** across the platform

Users now see real processor names instead of generic categories, making server selection more informed and professional.
