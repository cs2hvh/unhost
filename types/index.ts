/**
 * API Response Types
 * Standardized response interfaces for all API endpoints
 */

// Base API Response
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Paginated Response
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Server/Instance Types
 */
export interface Server {
  id: string;
  vmid: number;
  linode_id: number;
  node: string;
  name: string;
  ip: string;
  os: string;
  status: 'running' | 'stopped' | 'provisioning' | 'offline' | 'booting' | 'rebooting' | 'shutting_down';
  owner_id: string;
  location: string;
  created_at: string;
  plan_type: string;
  cores?: number;
  memory?: number;
  disk?: number;
  transfer?: number;
}

export interface ServerCreateRequest {
  hostname: string;
  region: string;
  image: string;
  planType: string;
  sshKeys: string[];
  ownerId: string;
  ownerEmail?: string;
}

export interface ServerCreateResponse extends ApiResponse {
  server?: Server;
  linode?: {
    id: number;
    label: string;
    status: string;
    ipv4: string[];
  };
  db?: {
    saved: boolean;
    id: number | null;
    error: string | null;
  };
  pricing?: {
    hourlyCost: number;
    initialCharge: number;
    planType: string;
  };
}

export interface ServerPowerActionResponse extends ApiResponse {
  action?: 'start' | 'stop' | 'reboot';
  instanceId?: number;
  region?: string;
  status?: string | null;
}

export interface ServerMetrics {
  t: number; // timestamp
  cpu: number | null;
  memUsed: number | null;
  netIn: number | null;
  netOut: number | null;
}

export interface ServerMetricsResponse extends ApiResponse {
  series?: ServerMetrics[];
}

/**
 * User Types
 */
export interface User {
  id: string;
  email: string;
  created_at: string;
  is_admin: boolean;
  is_banned: boolean;
  username?: string;
  user_metadata?: Record<string, unknown>;
}

export interface AuthResponse extends ApiResponse {
  user?: {
    id: string;
    email: string;
    username?: string;
  };
  session?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

/**
 * Wallet Types
 */
export interface Wallet {
  id: string;
  user_id: string;
  balance: string; // Decimal as string from DB
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  amount: string; // Decimal as string
  type: 'credit' | 'debit' | 'refund' | 'charge';
  description: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface WalletResponse extends ApiResponse {
  wallet?: Wallet;
  balance?: number;
  transactions?: WalletTransaction[];
}

/**
 * Support Ticket Types
 */
export interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_staff: boolean;
  created_at: string;
}

export interface TicketWithMessages extends Ticket {
  messages: TicketMessage[];
  user?: {
    email: string;
  };
}

export interface TicketResponse extends ApiResponse {
  ticket?: Ticket;
  tickets?: Ticket[];
}

export interface TicketMessagesResponse extends ApiResponse {
  messages?: TicketMessage[];
}

/**
 * Payment Types
 */
export interface CryptoPayment {
  id: string;
  user_id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: 'waiting' | 'confirming' | 'confirmed' | 'sending' | 'partially_paid' | 'finished' | 'failed' | 'refunded' | 'expired';
  pay_address?: string;
  pay_amount?: number;
  pay_currency?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentResponse extends ApiResponse {
  payment?: CryptoPayment;
  invoice_url?: string;
}

export interface CryptoCurrency {
  code: string;
  name: string;
  network?: string;
  logo_url?: string;
}

export interface CurrenciesResponse extends ApiResponse {
  currencies?: CryptoCurrency[];
}

/**
 * Admin Types
 */
export interface AdminStats {
  totalUsers: number;
  totalServers: number;
  activeServers: number;
  totalRevenue: number;
  pendingTickets: number;
}

export interface AdminUser extends User {
  servers_count?: number;
  wallet_balance?: number;
  last_login?: string;
}

export interface AdminServer extends Server {
  owner_email?: string;
  hourly_cost?: number;
  total_cost?: number;
}

export interface PricingConfig {
  id: string;
  plan_type: string;
  base_price: number;
  markup: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminStatsResponse extends ApiResponse {
  stats?: AdminStats;
}

export interface AdminUsersResponse extends ApiResponse {
  users?: AdminUser[];
}

export interface AdminServersResponse extends ApiResponse {
  servers?: AdminServer[];
}

export interface AdminPricingResponse extends ApiResponse {
  pricing?: PricingConfig[];
}

/**
 * Linode Types
 */
export interface LinodeRegion {
  id: string;
  name?: string;
  country?: string;
  capabilities?: string[];
}

export interface LinodeImage {
  id: string;
  label?: string;
  description?: string;
  is_public?: boolean;
  type?: string;
  vendor?: string;
}

export interface LinodePlanType {
  id: string;
  label: string;
  price: {
    hourly: number;
    monthly: number;
  };
  specs: {
    vcpus: number;
    memory: number;
    disk: number;
    transfer: number;
  };
  network_out?: number;
}

export interface LinodeOptionsResponse extends ApiResponse {
  regions?: LinodeRegion[];
  images?: LinodeImage[];
  groupedImages?: Record<string, LinodeImage[]>;
}

/**
 * Component Props Types
 */
export interface ServerCardProps {
  server: Server;
  onPowerAction?: (serverId: string, action: 'start' | 'stop' | 'reboot') => void;
  onDelete?: (server: Server) => void;
  onViewMetrics?: (serverId: string) => void;
  isLoading?: boolean;
}

export interface PlanSelectorProps {
  value: string;
  onChange: (planType: string) => void;
  pricing?: Record<string, { hourly: number; monthly: number }>;
  disabled?: boolean;
}

export interface LoadingSkeletonProps {
  variant?: 'card' | 'table' | 'list';
  count?: number;
  className?: string;
}

/**
 * Form Types
 */
export interface ServerCreateFormData {
  hostname: string;
  location: string;
  os: string;
  planType: string;
  planCategory: string;
  sshKeys: string[];
}

export interface TicketCreateFormData {
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Hook Return Types
 */
export interface UseUserReturn {
  user: User | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseWalletReturn {
  balance: number;
  wallet: Wallet | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseServersReturn {
  servers: Server[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createServer: (data: ServerCreateFormData) => Promise<ServerCreateResponse>;
  deleteServer: (serverId: string) => Promise<void>;
  powerAction: (serverId: string, action: 'start' | 'stop' | 'reboot') => Promise<void>;
}
