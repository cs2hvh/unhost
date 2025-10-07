# Linode Migration Guide

This project has been migrated from Proxmox to Linode for virtual machine provisioning.

## Changes Made

### 1. **Infrastructure Provider**
- **Old:** Self-hosted Proxmox hypervisor
- **New:** Linode cloud platform

### 2. **Authentication**
- **Old:** SSH password-based authentication
- **New:** SSH key-based authentication (more secure)

### 3. **API Integration**
- **Old:** Proxmox API with token/password auth
- **New:** Linode API v4 with Personal Access Token

### 4. **Regions**
Linode regions available:
- `us-east`: Newark, NJ
- `us-central`: Dallas, TX
- `us-west`: Fremont, CA
- `us-southeast`: Atlanta, GA
- `ca-central`: Toronto, Canada
- `eu-west`: London, UK
- `eu-central`: Frankfurt, Germany
- `ap-south`: Singapore
- `ap-northeast`: Tokyo, Japan
- `ap-southeast`: Sydney, Australia

### 5. **Pricing Model**
- **Old:** Custom pricing based on CPU/RAM/Storage
- **New:** Fixed Linode plan types:
  - Nanode (1GB): $5/month
  - Standard plans: $10-$160/month
  - Dedicated CPU plans: $30-$240/month

### 6. **Images/OS**
Available images:
- Ubuntu 24.04 LTS (linode/ubuntu24.04)
- Ubuntu 22.04 LTS (linode/ubuntu22.04)
- Ubuntu 20.04 LTS (linode/ubuntu20.04)
- Debian 12 (linode/debian12)
- Debian 11 (linode/debian11)
- CentOS Stream 9 (linode/centos-stream9)
- Fedora 39 (linode/fedora39)
- Alpine 3.19 (linode/alpine3.19)

### 7. **SSH Access**
- **Old:** `ssh ubuntu@<ip>` (with password)
- **New:** `ssh root@<ip>` (with SSH key)

### 8. **Networking**
- **Old:** Manual IP pool management, MAC address assignment
- **New:** Automatic IP assignment by Linode

## Environment Variables

### Required Variables

```bash
# Linode API Token (required)
LINODE_API_TOKEN=your_linode_personal_access_token

# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Admin Configuration
ADMIN_EMAILS=admin@example.com
```

### Getting a Linode API Token

1. Log in to [Linode Cloud Manager](https://cloud.linode.com/)
2. Click on your username → **API Tokens**
3. Click **Create a Personal Access Token**
4. Name: `crypto-cloud-api`
5. Expiry: **Never** (or set custom expiration)
6. Scopes:
   - **Linodes:** Read/Write
   - **IPs:** Read/Write (optional)
   - **Images:** Read Only
   - **Regions:** Read Only
   - **Types:** Read Only
7. Copy the generated token and add to `.env.local`

## Database Changes

### Tables to Update (if migrating existing data)

No schema changes required! The existing `servers` table works with Linode:
- `vmid` → stores Linode instance ID
- `node` → stores Linode region
- `location` → stores Linode region
- `ip` → stores assigned public IP

### No Longer Used
- `proxmox_hosts` table (can be dropped)
- `proxmox_templates` table (can be dropped)
- `public_ip_pools` table (can be dropped)
- `public_ip_pool_ips` table (can be dropped)

## API Routes

### New Linode Routes
- `POST /api/linode/instances/create` - Create instance
- `GET /api/linode/instances` - List instances
- `POST /api/linode/instances/power` - Power management
- `GET /api/linode/instances/metrics` - Instance stats
- `GET /api/linode/health` - API connectivity check
- `GET /api/linode/options` - Available regions/images/plans

### Removed Proxmox Routes
- `/api/proxmox/vms/*` (deleted)
- `/api/proxmox/health` (deleted)
- `/api/infra/options` (deleted)

## Deployment Checklist

- [ ] Set `LINODE_API_TOKEN` in production environment
- [ ] Update Supabase environment variables
- [ ] Test instance creation with SSH keys
- [ ] Verify billing/wallet integration
- [ ] Test power management (start/stop/reboot)
- [ ] Verify metrics/monitoring
- [ ] Test in all supported regions

## Testing

### Local Testing
```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# 3. Run development server
npm run dev

# 4. Test instance creation
# Go to http://localhost:3000/dashboard/servers
```

### Production Deployment
```bash
# Build the project
npm run build

# Start production server
npm start
```

## Troubleshooting

### Common Issues

1. **"Linode API token not configured"**
   - Solution: Set `LINODE_API_TOKEN` in environment variables

2. **"Insufficient wallet balance"**
   - Solution: Ensure user has sufficient funds (minimum 1 hour of server cost)

3. **"Failed to create instance: 401"**
   - Solution: Verify Linode API token is valid and has correct permissions

4. **SSH key not working**
   - Solution: Ensure SSH public key is in correct format (ssh-rsa, ssh-ed25519, etc.)

5. **Region not available**
   - Solution: Check `/api/linode/options` for available regions

## Support

For issues or questions, contact the development team or check:
- [Linode API Documentation](https://www.linode.com/docs/api/)
- [Linode Community](https://www.linode.com/community/)
