// Linode API helper library
import axios, { AxiosInstance } from 'axios';

export interface LinodeConfig {
  api_token: string;
  region: string;
  default_image?: string;
}

export interface CreateInstanceParams {
  label: string;
  region: string;
  type: string; // Plan type (e.g., g6-nanode-1, g6-standard-1)
  image: string; // Distribution (e.g., linode/ubuntu24.04)
  root_pass?: string; // Optional if using authorized_keys
  authorized_keys?: string[]; // SSH public keys
  backups_enabled?: boolean;
  private_ip?: boolean;
  tags?: string[];
  metadata?: {
    user_data?: string; // Cloud-init user data
  };
}

export interface LinodeInstance {
  id: number;
  label: string;
  region: string;
  type: string;
  status: 'running' | 'offline' | 'booting' | 'rebooting' | 'shutting_down' | 'provisioning' | 'deleting' | 'migrating' | 'rebuilding' | 'cloning' | 'restoring';
  ipv4: string[];
  ipv6?: string;
  image?: string;
  specs: {
    disk: number;
    memory: number;
    vcpus: number;
    transfer: number;
  };
  created: string;
  updated: string;
  tags?: string[];
}

export interface LinodeStats {
  cpu?: Array<[number, number]>; // [timestamp, value]
  io?: {
    io?: Array<[number, number]>;
    swap?: Array<[number, number]>;
  };
  netv4?: {
    in?: Array<[number, number]>;
    out?: Array<[number, number]>;
    private_in?: Array<[number, number]>;
    private_out?: Array<[number, number]>;
  };
  netv6?: {
    in?: Array<[number, number]>;
    out?: Array<[number, number]>;
    private_in?: Array<[number, number]>;
    private_out?: Array<[number, number]>;
  };
}

// Linode regions with country info and flag codes (all available regions)
export const LINODE_REGIONS = {
  // Americas
  'us-east': { name: 'Newark', country: 'United States', countryCode: 'US', city: 'Newark, NJ' },
  'us-central': { name: 'Dallas', country: 'United States', countryCode: 'US', city: 'Dallas, TX' },
  'us-west': { name: 'Fremont', country: 'United States', countryCode: 'US', city: 'Fremont, CA' },
  'us-southeast': { name: 'Atlanta', country: 'United States', countryCode: 'US', city: 'Atlanta, GA' },
  'us-lax': { name: 'Los Angeles', country: 'United States', countryCode: 'US', city: 'Los Angeles, CA' },
  'us-mia': { name: 'Miami', country: 'United States', countryCode: 'US', city: 'Miami, FL' },
  'us-sea': { name: 'Seattle', country: 'United States', countryCode: 'US', city: 'Seattle, WA' },
  'us-ord': { name: 'Chicago', country: 'United States', countryCode: 'US', city: 'Chicago, IL' },
  'us-iad': { name: 'Washington', country: 'United States', countryCode: 'US', city: 'Washington, DC' },
  'ca-central': { name: 'Toronto', country: 'Canada', countryCode: 'CA', city: 'Toronto' },
  'br-gru': { name: 'São Paulo', country: 'Brazil', countryCode: 'BR', city: 'São Paulo' },

  // Europe
  'eu-west': { name: 'London', country: 'United Kingdom', countryCode: 'GB', city: 'London' },
  'gb-lon': { name: 'London 2', country: 'United Kingdom', countryCode: 'GB', city: 'London' },
  'eu-central': { name: 'Frankfurt', country: 'Germany', countryCode: 'DE', city: 'Frankfurt' },
  'de-fra-2': { name: 'Frankfurt 2', country: 'Germany', countryCode: 'DE', city: 'Frankfurt' },
  'fr-par': { name: 'Paris', country: 'France', countryCode: 'FR', city: 'Paris' },
  'it-mil': { name: 'Milan', country: 'Italy', countryCode: 'IT', city: 'Milan' },
  'nl-ams': { name: 'Amsterdam', country: 'Netherlands', countryCode: 'NL', city: 'Amsterdam' },
  'se-sto': { name: 'Stockholm', country: 'Sweden', countryCode: 'SE', city: 'Stockholm' },
  'es-mad': { name: 'Madrid', country: 'Spain', countryCode: 'ES', city: 'Madrid' },

  // Asia Pacific
  'ap-south': { name: 'Singapore', country: 'Singapore', countryCode: 'SG', city: 'Singapore' },
  'sg-sin-2': { name: 'Singapore 2', country: 'Singapore', countryCode: 'SG', city: 'Singapore' },
  'ap-northeast': { name: 'Tokyo', country: 'Japan', countryCode: 'JP', city: 'Tokyo' },
  'jp-tyo-3': { name: 'Tokyo 3', country: 'Japan', countryCode: 'JP', city: 'Tokyo' },
  'jp-osa': { name: 'Osaka', country: 'Japan', countryCode: 'JP', city: 'Osaka' },
  'ap-southeast': { name: 'Sydney', country: 'Australia', countryCode: 'AU', city: 'Sydney' },
  'au-mel': { name: 'Melbourne', country: 'Australia', countryCode: 'AU', city: 'Melbourne' },
  'ap-west': { name: 'Mumbai', country: 'India', countryCode: 'IN', city: 'Mumbai' },
  'in-bom-2': { name: 'Mumbai 2', country: 'India', countryCode: 'IN', city: 'Mumbai' },
  'in-maa': { name: 'Chennai', country: 'India', countryCode: 'IN', city: 'Chennai' },
  'id-cgk': { name: 'Jakarta', country: 'Indonesia', countryCode: 'ID', city: 'Jakarta' },
} as const;

// Helper function to get flag URL
export function getFlagUrl(countryCode: string, size: number = 64): string {
  return `https://flagsapi.com/${countryCode}/shiny/${size}.png`;
}

// Linode plan categories
export const LINODE_PLAN_CATEGORIES = {
  'shared': 'Shared CPU',
  'dedicated': 'Dedicated CPU',
  'highmem': 'High Memory',
  'premium': 'Premium CPU',
} as const;

// Common Linode plan types (official pricing as of 2025)
export const LINODE_PLAN_TYPES = {
  // Shared CPU - Standard
  'g6-standard-1': {
    category: 'shared',
    label: 'Linode 2GB',
    vcpus: 1,
    memory: 2048,
    disk: 51200,
    transfer: 2000,
    hourly: 0.015,
    monthly: 10
  },
  'g6-standard-2': {
    category: 'shared',
    label: 'Linode 4GB',
    vcpus: 2,
    memory: 4096,
    disk: 81920,
    transfer: 4000,
    hourly: 0.03,
    monthly: 20
  },
  'g6-standard-4': {
    category: 'shared',
    label: 'Linode 8GB',
    vcpus: 4,
    memory: 8192,
    disk: 163840,
    transfer: 5000,
    hourly: 0.06,
    monthly: 40
  },
  'g6-standard-6': {
    category: 'shared',
    label: 'Linode 16GB',
    vcpus: 6,
    memory: 16384,
    disk: 327680,
    transfer: 8000,
    hourly: 0.12,
    monthly: 80
  },
  'g6-standard-8': {
    category: 'shared',
    label: 'Linode 32GB',
    vcpus: 8,
    memory: 32768,
    disk: 655360,
    transfer: 16000,
    hourly: 0.24,
    monthly: 160
  },

  // Dedicated CPU
  'g6-dedicated-2': {
    category: 'dedicated',
    label: 'Dedicated 4GB',
    vcpus: 2,
    memory: 4096,
    disk: 81920,
    transfer: 4000,
    hourly: 0.045,
    monthly: 30
  },
  'g6-dedicated-4': {
    category: 'dedicated',
    label: 'Dedicated 8GB',
    vcpus: 4,
    memory: 8192,
    disk: 163840,
    transfer: 5000,
    hourly: 0.09,
    monthly: 60
  },
  'g6-dedicated-8': {
    category: 'dedicated',
    label: 'Dedicated 16GB',
    vcpus: 8,
    memory: 16384,
    disk: 327680,
    transfer: 6000,
    hourly: 0.18,
    monthly: 120
  },
  'g6-dedicated-16': {
    category: 'dedicated',
    label: 'Dedicated 32GB',
    vcpus: 16,
    memory: 32768,
    disk: 655360,
    transfer: 8000,
    hourly: 0.36,
    monthly: 240
  },
  'g6-dedicated-32': {
    category: 'dedicated',
    label: 'Dedicated 64GB',
    vcpus: 32,
    memory: 65536,
    disk: 1310720,
    transfer: 9000,
    hourly: 0.72,
    monthly: 480
  },

  // High Memory
  'g6-highmem-2': {
    category: 'highmem',
    label: 'High Memory 16GB',
    vcpus: 2,
    memory: 16384,
    disk: 81920,
    transfer: 5000,
    hourly: 0.09,
    monthly: 60
  },
  'g6-highmem-4': {
    category: 'highmem',
    label: 'High Memory 32GB',
    vcpus: 4,
    memory: 32768,
    disk: 163840,
    transfer: 6000,
    hourly: 0.18,
    monthly: 120
  },
  'g6-highmem-8': {
    category: 'highmem',
    label: 'High Memory 64GB',
    vcpus: 8,
    memory: 65536,
    disk: 327680,
    transfer: 7000,
    hourly: 0.36,
    monthly: 240
  },
  'g6-highmem-16': {
    category: 'highmem',
    label: 'High Memory 128GB',
    vcpus: 16,
    memory: 131072,
    disk: 655360,
    transfer: 8000,
    hourly: 0.72,
    monthly: 480
  },
} as const;

// Common OS images with logos (grouped by distribution)
export const LINODE_IMAGES = {
  // Ubuntu
  'linode/ubuntu25.04': { name: '25.04', category: 'Ubuntu', logo: 'https://assets.ubuntu.com/v1/29985a98-ubuntu-logo32.png' },
  'linode/ubuntu24.10': { name: '24.10', category: 'Ubuntu', logo: 'https://assets.ubuntu.com/v1/29985a98-ubuntu-logo32.png' },
  'linode/ubuntu24.04': { name: '24.04 LTS', category: 'Ubuntu', logo: 'https://assets.ubuntu.com/v1/29985a98-ubuntu-logo32.png' },
  'linode/ubuntu22.04': { name: '22.04 LTS', category: 'Ubuntu', logo: 'https://assets.ubuntu.com/v1/29985a98-ubuntu-logo32.png' },

  // Debian
  'linode/debian13': { name: '13', category: 'Debian', logo: 'https://www.debian.org/logos/openlogo-nd-50.png' },
  'linode/debian12': { name: '12', category: 'Debian', logo: 'https://www.debian.org/logos/openlogo-nd-50.png' },
  'linode/debian11': { name: '11', category: 'Debian', logo: 'https://www.debian.org/logos/openlogo-nd-50.png' },

  // Fedora
  'linode/fedora42': { name: '42', category: 'Fedora', logo: 'https://fedoraproject.org/favicon.ico' },
  'linode/fedora41': { name: '41', category: 'Fedora', logo: 'https://fedoraproject.org/favicon.ico' },

  // Alpine
  'linode/alpine3.22': { name: '3.22', category: 'Alpine', logo: 'https://alpinelinux.org/alpine-logo.ico' },
  'linode/alpine3.21': { name: '3.21', category: 'Alpine', logo: 'https://alpinelinux.org/alpine-logo.ico' },
  'linode/alpine3.20': { name: '3.20', category: 'Alpine', logo: 'https://alpinelinux.org/alpine-logo.ico' },

  // Arch
  'linode/arch': { name: 'Latest', category: 'Arch Linux', logo: 'https://archlinux.org/static/favicon.ico' },

  // Kali
  'linode/kali': { name: 'Latest', category: 'Kali Linux', logo: 'https://www.kali.org/images/favicon.ico' },

  // CentOS Stream
  'linode/centos-stream10': { name: 'Stream 10', category: 'CentOS', logo: 'https://www.centos.org/assets/img/favicon.png' },
  'linode/centos-stream9': { name: 'Stream 9', category: 'CentOS', logo: 'https://www.centos.org/assets/img/favicon.png' },

  // Rocky Linux
  'linode/rocky10': { name: '10', category: 'Rocky Linux', logo: 'https://rockylinux.org/favicon.png' },
  'linode/rocky9': { name: '9', category: 'Rocky Linux', logo: 'https://rockylinux.org/favicon.png' },
  'linode/rocky8': { name: '8', category: 'Rocky Linux', logo: 'https://rockylinux.org/favicon.png' },

  // AlmaLinux
  'linode/almalinux10': { name: '10', category: 'AlmaLinux', logo: 'https://almalinux.org/fav/favicon.ico' },
  'linode/almalinux9': { name: '9', category: 'AlmaLinux', logo: 'https://almalinux.org/fav/favicon.ico' },

  // openSUSE
  'linode/opensuse15.6': { name: 'Leap 15.6', category: 'openSUSE', logo: 'https://www.opensuse.org/assets/img/favicon-for-light-192.png' },

  // Gentoo
  'linode/gentoo': { name: 'Latest', category: 'Gentoo', logo: 'https://www.gentoo.org/assets/img/logo/gentoo-g.png' },
} as const;

export class LinodeAPIClient {
  private client: AxiosInstance;
  private config: LinodeConfig;

  constructor(config: LinodeConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: 'https://api.linode.com/v4',
      headers: {
        'Authorization': `Bearer ${config.api_token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create a new Linode instance
   */
  async createInstance(params: CreateInstanceParams): Promise<LinodeInstance> {
    try {
      const response = await this.client.post('/linode/instances', {
        label: params.label,
        region: params.region,
        type: params.type,
        image: params.image,
        root_pass: params.root_pass,
        authorized_keys: params.authorized_keys,
        backups_enabled: params.backups_enabled || false,
        private_ip: params.private_ip || false,
        tags: params.tags,
        metadata: params.metadata,
      });

      return this.normalizeInstance(response.data);
    } catch (error: any) {
      const message = error?.response?.data?.errors?.[0]?.reason || error?.message || error;
      throw new Error(`Failed to create Linode instance: ${message}`);
    }
  }

  /**
   * List all Linode instances
   */
  async listInstances(): Promise<LinodeInstance[]> {
    try {
      const response = await this.client.get('/linode/instances');
      return response.data.data.map((instance: any) => this.normalizeInstance(instance));
    } catch (error: any) {
      const message = error?.response?.data?.errors?.[0]?.reason || error?.message || error;
      throw new Error(`Failed to list Linode instances: ${message}`);
    }
  }

  /**
   * Get a specific Linode instance
   */
  async getInstance(instanceId: number): Promise<LinodeInstance> {
    try {
      const response = await this.client.get(`/linode/instances/${instanceId}`);
      return this.normalizeInstance(response.data);
    } catch (error: any) {
      const message = error?.response?.data?.errors?.[0]?.reason || error?.message || error;
      throw new Error(`Failed to get Linode instance: ${message}`);
    }
  }

  /**
   * Boot a Linode instance
   */
  async bootInstance(instanceId: number): Promise<void> {
    try {
      await this.client.post(`/linode/instances/${instanceId}/boot`);
    } catch (error: any) {
      const message = error?.response?.data?.errors?.[0]?.reason || error?.message || error;
      throw new Error(`Failed to boot Linode instance: ${message}`);
    }
  }

  /**
   * Shutdown a Linode instance
   */
  async shutdownInstance(instanceId: number): Promise<void> {
    try {
      await this.client.post(`/linode/instances/${instanceId}/shutdown`);
    } catch (error: any) {
      const message = error?.response?.data?.errors?.[0]?.reason || error?.message || error;
      throw new Error(`Failed to shutdown Linode instance: ${message}`);
    }
  }

  /**
   * Reboot a Linode instance
   */
  async rebootInstance(instanceId: number): Promise<void> {
    try {
      await this.client.post(`/linode/instances/${instanceId}/reboot`);
    } catch (error: any) {
      const message = error?.response?.data?.errors?.[0]?.reason || error?.message || error;
      throw new Error(`Failed to reboot Linode instance: ${message}`);
    }
  }

  /**
   * Rebuild a Linode instance (wipes data and reinstalls OS)
   */
  async rebuildInstance(instanceId: number, image: string, rootPass: string, authorizedKeys?: string[]): Promise<LinodeInstance> {
    try {
      const payload: any = {
        image,
        root_pass: rootPass,
      };

      if (authorizedKeys && authorizedKeys.length > 0) {
        payload.authorized_keys = authorizedKeys;
      }

      const response = await this.client.post(`/linode/instances/${instanceId}/rebuild`, payload);
      return response.data;
    } catch (error: any) {
      const message = error?.response?.data?.errors?.[0]?.reason || error?.message || error;
      throw new Error(`Failed to rebuild Linode instance: ${message}`);
    }
  }

  /**
   * Delete a Linode instance
   */
  async deleteInstance(instanceId: number): Promise<void> {
    try {
      await this.client.delete(`/linode/instances/${instanceId}`);
    } catch (error: any) {
      const message = error?.response?.data?.errors?.[0]?.reason || error?.message || error;
      throw new Error(`Failed to delete Linode instance: ${message}`);
    }
  }

  /**
   * Get instance statistics
   */
  async getInstanceStats(instanceId: number): Promise<LinodeStats> {
    try {
      const response = await this.client.get(`/linode/instances/${instanceId}/stats`);
      return response.data;
    } catch (error: any) {
      const message = error?.response?.data?.errors?.[0]?.reason || error?.message || error;
      throw new Error(`Failed to get Linode instance stats: ${message}`);
    }
  }

  /**
   * Resize a Linode instance
   */
  async resizeInstance(instanceId: number, type: string): Promise<void> {
    try {
      await this.client.post(`/linode/instances/${instanceId}/resize`, { type });
    } catch (error: any) {
      const message = error?.response?.data?.errors?.[0]?.reason || error?.message || error;
      throw new Error(`Failed to resize Linode instance: ${message}`);
    }
  }

  /**
   * Get available regions
   */
  async getRegions(): Promise<Array<{ id: string; label: string; country: string }>> {
    try {
      const response = await this.client.get('/regions');
      return response.data.data.map((region: any) => ({
        id: region.id,
        label: region.label,
        country: region.country,
      }));
    } catch (error: any) {
      const message = error?.response?.data?.errors?.[0]?.reason || error?.message || error;
      throw new Error(`Failed to get regions: ${message}`);
    }
  }

  /**
   * Get available images
   */
  async getImages(): Promise<Array<{ id: string; label: string; size: number }>> {
    try {
      const response = await this.client.get('/images');
      return response.data.data
        .filter((image: any) => image.is_public && image.status === 'available')
        .map((image: any) => ({
          id: image.id,
          label: image.label,
          size: image.size,
        }));
    } catch (error: any) {
      const message = error?.response?.data?.errors?.[0]?.reason || error?.message || error;
      throw new Error(`Failed to get images: ${message}`);
    }
  }

  /**
   * Get available plan types
   */
  async getTypes(): Promise<Array<{ id: string; label: string; price: any; specs: any }>> {
    try {
      const response = await this.client.get('/linode/types');
      return response.data.data.map((type: any) => ({
        id: type.id,
        label: type.label,
        price: type.price,
        specs: {
          disk: type.disk,
          memory: type.memory,
          vcpus: type.vcpus,
          transfer: type.transfer,
        },
      }));
    } catch (error: any) {
      const message = error?.response?.data?.errors?.[0]?.reason || error?.message || error;
      throw new Error(`Failed to get types: ${message}`);
    }
  }

  /**
   * Normalize Linode instance response
   */
  private normalizeInstance(instance: any): LinodeInstance {
    return {
      id: instance.id,
      label: instance.label,
      region: instance.region,
      type: instance.type,
      status: instance.status,
      ipv4: instance.ipv4 || [],
      ipv6: instance.ipv6,
      image: instance.image,
      specs: instance.specs || {
        disk: 0,
        memory: 0,
        vcpus: 0,
        transfer: 0,
      },
      created: instance.created,
      updated: instance.updated,
      tags: instance.tags,
    };
  }
}

/**
 * Get plans grouped by category
 */
export function getPlansByCategory() {
  const grouped: Record<string, Array<{ id: string; plan: any }>> = {};

  Object.entries(LINODE_PLAN_TYPES).forEach(([id, plan]) => {
    const category = plan.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push({ id, plan });
  });

  return grouped;
}

/**
 * Get hourly cost for a Linode plan
 */
export function getLinodePlanCost(planType: string): { hourly: number; monthly: number } {
  const plan = LINODE_PLAN_TYPES[planType as keyof typeof LINODE_PLAN_TYPES];
  if (!plan) {
    return { hourly: 0, monthly: 0 };
  }
  return { hourly: plan.hourly, monthly: plan.monthly };
}
