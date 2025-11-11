# Adding More CPU Types - Quick Guide

## Current Structure

**Plan Type (Category)** → **CPU Options**

### Currently Available (1 CPU per type):
- **Shared** → Intel Xeon 2334S
- **Dedicated** → Intel Xeon 4343  
- **High Memory** → Intel Xeon 5644
- **Premium** → Intel Xeon 5644
- **Storage** → Intel Xeon 5644
- **GPU** → Intel Xeon 5644

## Adding More CPUs to Existing Categories

### Example: Add AMD Ryzen to Shared Plans

```sql
INSERT INTO public.cpu_types (plan_category, cpu_name, cpu_description, is_active, display_order)
VALUES
  ('shared', 'AMD Ryzen 9 7950X', 'High-performance multi-core processor', true, 2);
```

### Example: Add Multiple CPUs to Dedicated

```sql
INSERT INTO public.cpu_types (plan_category, cpu_name, cpu_description, is_active, display_order)
VALUES
  ('dedicated', 'AMD EPYC 7763', 'High core count for parallel workloads', true, 2),
  ('dedicated', 'Intel Xeon Gold 6348', 'Enterprise-grade reliability', true, 3);
```

## Display Order

- `display_order = 1` → Shows first
- `display_order = 2` → Shows second
- `display_order = 3` → Shows third
- etc.

## Disable a CPU Option

```sql
UPDATE public.cpu_types
SET is_active = false
WHERE cpu_name = 'Intel Xeon 2334S';
```

## View All CPUs by Category

```sql
SELECT plan_category, cpu_name, is_active, display_order
FROM public.cpu_types
ORDER BY plan_category, display_order;
```

## Expected Result After Adding More CPUs

When user creates a server:

1. **Step 1**: Select Plan Type
   - ○ Shared
   - ○ Dedicated
   - ○ High Memory
   - ○ Premium
   - ○ Storage

2. **Step 2**: Select CPU (example if Shared selected)
   - ○ Intel Xeon 2334S (Balanced performance)
   - ○ AMD Ryzen 9 7950X (High-performance)
   - ○ Intel Core i9-13900K (Gaming optimized)

3. **Step 3**: Select Plan Size
   - Standard 2GB - $10/mo
   - Standard 4GB - $20/mo
   - etc.

## Admin Panel

In the "CPU Types" tab, you'll see:

### Shared
- Intel Xeon 2334S ✓ Active [Edit]
- AMD Ryzen 9 7950X ✓ Active [Edit]

### Dedicated  
- Intel Xeon 4343 ✓ Active [Edit]
- AMD EPYC 7763 ✓ Active [Edit]

etc.
