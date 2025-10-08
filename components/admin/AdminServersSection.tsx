'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { InlineLoader } from '@/components/ui/loader';
import { useConfirmation } from '@/components/ui/confirmation-dialog';
import { toast } from 'sonner';
import { FaSync, FaTrash, FaSearch, FaServer } from 'react-icons/fa';

interface Server {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string;
  ip: string;
  location: string;
  os: string;
  status: string;
  cpu_cores?: number;
  memory_mb?: number;
  disk_gb?: number;
  linode_id?: number;
  created_at: string;
}

type AdminServersSectionProps = {
  getAccessToken: () => Promise<string | null>;
};

export function AdminServersSection({ getAccessToken }: AdminServersSectionProps) {
  const [servers, setServers] = useState<Server[]>([]);
  const [filteredServers, setFilteredServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirm, ConfirmationDialog } = useConfirmation();

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/admin/servers', {
        headers,
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch servers');
      }

      const data = await response.json();
      if (data.ok && data.servers) {
        setServers(data.servers);
        setFilteredServers(data.servers);
      } else {
        throw new Error(data.error || 'Failed to load servers');
      }
    } catch (error: any) {
      console.error('Error loading servers:', error);
      toast.error(error.message || 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  useEffect(() => {
    let filtered = servers;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        s =>
          s.name?.toLowerCase().includes(query) ||
          s.owner_email?.toLowerCase().includes(query) ||
          s.ip?.toLowerCase().includes(query) ||
          s.location?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    setFilteredServers(filtered);
  }, [searchQuery, statusFilter, servers]);

  const handleDelete = (server: Server) => {
    confirm({
      title: 'Delete Server',
      message: `Are you sure you want to delete server "${server.name}"? This will also delete the Linode instance if it exists. This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        setDeletingId(server.id);
        try {
          const token = await getAccessToken();
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch('/api/admin/servers', {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ serverId: server.id }),
          });

          const data = await response.json();
          if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Failed to delete server');
          }

          // Show detailed success message
          console.log('Delete response:', data);
          console.log('Server had linode_id?', server.linode_id);

          if (data.linodeError) {
            toast.error(`${data.message}: ${data.linodeError}`);
          } else if (data.linodeDeleted && server.linode_id) {
            toast.success('✅ Server deleted from both database and Linode');
          } else if (!server.linode_id) {
            toast.warning('⚠️ Server deleted from database (no Linode ID found)');
          } else {
            toast.warning(data.message || `Server "${server.name}" deleted`);
          }

          await loadServers();
        } catch (error: any) {
          console.error('Error deleting server:', error);
          toast.error(error.message || 'Failed to delete server');
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

  const uniqueStatuses = ['all', ...new Set(servers.map(s => s.status).filter(Boolean))];

  return (
    <>
      <Card className="bg-black/50 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">All Servers</CardTitle>
              <CardDescription className="text-white/60">
                Manage all user servers across the platform
              </CardDescription>
            </div>
            <Button
              onClick={loadServers}
              disabled={loading}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/10"
            >
              <FaSync className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                type="text"
                placeholder="Search by name, email, IP, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-black text-white border-white/10 pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-black text-white border border-white/10 rounded-md"
            >
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Statuses' : status}
                </option>
              ))}
            </select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="text-white/60 text-sm">Total Servers</div>
              <div className="text-white text-2xl font-semibold">{servers.length}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="text-white/60 text-sm">Running</div>
              <div className="text-green-400 text-2xl font-semibold">
                {servers.filter(s => s.status === 'running').length}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="text-white/60 text-sm">Filtered Results</div>
              <div className="text-white text-2xl font-semibold">{filteredServers.length}</div>
            </div>
          </div>

          {/* Servers Table */}
          {loading ? (
            <div className="flex justify-center py-8">
              <InlineLoader text="Loading servers" />
            </div>
          ) : filteredServers.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              {servers.length === 0 ? (
                <>
                  <FaServer className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>No servers found</p>
                </>
              ) : (
                <p>No servers match your filters</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-white/60 border-b border-white/10">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Owner</th>
                    <th className="py-2 pr-4">IP</th>
                    <th className="py-2 pr-4">Location</th>
                    <th className="py-2 pr-4">Specs</th>
                    <th className="py-2 pr-4">OS</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServers.map((server) => (
                    <tr key={server.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 pr-4 text-white font-medium">{server.name}</td>
                      <td className="py-3 pr-4 text-white/80">{server.owner_email}</td>
                      <td className="py-3 pr-4 text-white/80 font-mono text-xs">{server.ip}</td>
                      <td className="py-3 pr-4 text-white/80">{server.location}</td>
                      <td className="py-3 pr-4 text-white/70 text-xs">
                        {server.cpu_cores || '?'} vCPU • {server.memory_mb || 0} MB
                        {server.disk_gb && ` • ${server.disk_gb} GB`}
                      </td>
                      <td className="py-3 pr-4 text-white/80 text-xs">{server.os || 'N/A'}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                            server.status === 'running'
                              ? 'bg-green-500/20 text-green-400'
                              : server.status === 'provisioning'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : server.status === 'stopped' || server.status === 'offline'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-white/10 text-white/80'
                          }`}
                        >
                          {server.status || 'unknown'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-white/70 text-xs">
                        {new Date(server.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <Button
                          onClick={() => handleDelete(server)}
                          disabled={deletingId === server.id}
                          size="sm"
                          className="bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40"
                        >
                          {deletingId === server.id ? (
                            <InlineLoader text="" />
                          ) : (
                            <>
                              <FaTrash className="h-3 w-3 mr-1" />
                              Delete
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmationDialog />
    </>
  );
}
