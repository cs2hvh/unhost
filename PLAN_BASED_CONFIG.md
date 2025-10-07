# Linode Plan-Based Configuration

The system now uses Linode's predefined plan types instead of custom CPU/RAM/Disk configurations.

## What Changed

### ✅ Before (Proxmox)
- Users entered: CPU cores, RAM GB, Disk GB
- System calculated custom pricing
- Manual resource allocation

### ✅ After (Linode)
- Users select from predefined Linode plans
- Fixed pricing per plan type
- Automatic resource allocation based on plan

## Plan Categories

### 1. **Shared CPU** (Best for development, websites)
- Nanode 1GB - $5/mo (1 vCPU, 1GB RAM, 25GB SSD)
- Linode 2GB - $10/mo (1 vCPU, 2GB RAM, 50GB SSD)
- Linode 4GB - $20/mo (2 vCPU, 4GB RAM, 80GB SSD)
- Linode 8GB - $40/mo (4 vCPU, 8GB RAM, 160GB SSD)
- Linode 16GB - $80/mo (6 vCPU, 16GB RAM, 320GB SSD)
- Linode 32GB - $160/mo (8 vCPU, 32GB RAM, 640GB SSD)

### 2. **Dedicated CPU** (Best for production, databases)
- Dedicated 4GB - $30/mo (2 vCPU, 4GB RAM, 80GB SSD)
- Dedicated 8GB - $60/mo (4 vCPU, 8GB RAM, 160GB SSD)
- Dedicated 16GB - $120/mo (8 vCPU, 16GB RAM, 320GB SSD)
- Dedicated 32GB - $240/mo (16 vCPU, 32GB RAM, 640GB SSD)
- Dedicated 64GB - $480/mo (32 vCPU, 64GB RAM, 1280GB SSD)

### 3. **High Memory** (Best for memory-intensive apps)
- High Memory 16GB - $60/mo (2 vCPU, 16GB RAM, 80GB SSD)
- High Memory 32GB - $120/mo (4 vCPU, 32GB RAM, 160GB SSD)
- High Memory 64GB - $240/mo (8 vCPU, 64GB RAM, 320GB SSD)
- High Memory 128GB - $480/mo (16 vCPU, 128GB RAM, 640GB SSD)

## UI Flow

### Step 3: Plan Selection
1. **Select Category** (Shared CPU / Dedicated CPU / High Memory)
2. **Choose Plan** from available options in that category
3. **View Plan Details**:
   - vCPU cores
   - Memory (GB)
   - Storage (GB SSD)
   - Transfer (GB)
   - Price ($X/mo, $X/hr)

### What Users See
```
Plan Category: Shared CPU

Select Plan:
▼ Linode 4GB - 2 vCPU, 4GB RAM, 80GB SSD - $20/mo

Plan Details:
┌─────────────────────┐
│ vCPU:      2 cores  │
│ Memory:    4 GB     │
│ Storage:   80 GB SSD│
│ Transfer:  4000 GB  │
└─────────────────────┘
```

## API Changes

### Request Format (New)
```json
{
  "hostname": "my-server",
  "region": "us-east",
  "image": "linode/ubuntu24.04",
  "planType": "g6-standard-2",
  "sshKeys": ["ssh-rsa AAAA..."],
  "ownerId": "user-id",
  "ownerEmail": "user@example.com"
}
```

### Request Format (Old - Removed)
```json
{
  "hostname": "my-server",
  "location": "us_east",
  "os": "Ubuntu 24.04 LTS",
  "cpuCores": 2,
  "memoryMB": 4096,
  "diskGB": 80,
  "sshPassword": "...",
  "ownerId": "user-id"
}
```

## Database Storage

Servers table stores plan details:
```sql
INSERT INTO servers (
  vmid,              -- Linode instance ID
  node,              -- Region (us-east, etc.)
  name,              -- Hostname
  ip,                -- Assigned IP
  os,                -- Image ID (linode/ubuntu24.04)
  location,          -- Region
  cpu_cores,         -- From plan.vcpus
  memory_mb,         -- From plan.memory
  disk_gb,           -- From plan.disk / 1024
  details,           -- { planType: "g6-standard-2" }
  hourly_cost,       -- From plan.hourly
  ...
)
```

## Pricing Calculation

### New Method
```typescript
// Simple: Get cost directly from plan
const specs = { planType: "g6-standard-2", location: "us-east" };
const hourlyCost = calculateHourlyCost(specs); // $0.03/hr
const monthlyCost = calculateMonthlyCost(specs); // $20/mo
```

### Old Method (Removed)
```typescript
// Complex: Calculate based on resources
const specs = { cpuCores: 2, memoryGB: 4, diskGB: 80 };
// Auto-select closest plan, calculate custom price...
```

## Benefits

✅ **Simpler UX**: Users select from clear, predefined options
✅ **Accurate Pricing**: Matches Linode's official pricing exactly
✅ **Better Performance**: No complex calculation logic
✅ **Easier Maintenance**: Plans defined in one place (`LINODE_PLAN_TYPES`)
✅ **Matches Industry Standard**: Same UX as AWS, DigitalOcean, etc.

## Adding New Plans

To add new Linode plans, update `/lib/linode.ts`:

```typescript
export const LINODE_PLAN_TYPES = {
  // ...existing plans...

  'g6-standard-12': {
    category: 'shared',
    label: 'Linode 64GB',
    vcpus: 12,
    memory: 65536,
    disk: 1280000,
    transfer: 20000,
    hourly: 0.48,
    monthly: 320
  },
} as const;
```

That's it! The UI will automatically show the new plan.
