import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Server, ServerCreateRequest, ServerCreateResponse, ServerPowerActionResponse } from "@/types";

const supabase = createClient();

/**
 * Fetch servers for the current user
 */
export function useServers(userId?: string) {
  return useQuery({
    queryKey: ["servers", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("servers")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Server[];
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
  });
}

/**
 * Create a new server
 */
export function useCreateServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ServerCreateRequest) => {
      const response = await fetch("/api/linode/instances/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create server");
      }

      return response.json() as Promise<ServerCreateResponse>;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch servers list
      queryClient.invalidateQueries({ queryKey: ["servers", variables.ownerId] });
    },
  });
}

/**
 * Perform power action on server (start/stop/reboot)
 */
export function useServerPowerAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      serverId, 
      action,
      userId 
    }: { 
      serverId: string; 
      action: "start" | "stop" | "reboot";
      userId: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch("/api/linode/instances/power", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ serverId, action }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Power action failed");
      }

      return response.json() as Promise<ServerPowerActionResponse>;
    },
    onSuccess: (data, variables) => {
      // Invalidate servers list to refetch updated status
      queryClient.invalidateQueries({ queryKey: ["servers", variables.userId] });
    },
  });
}

/**
 * Delete a server
 */
export function useDeleteServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serverId, userId }: { serverId: string; userId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch("/api/linode/instances/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ serverId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete server");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Remove server from cache and refetch
      queryClient.invalidateQueries({ queryKey: ["servers", variables.userId] });
    },
  });
}

/**
 * Fetch server metrics
 */
export function useServerMetrics(serverId?: string, userId?: string) {
  return useQuery({
    queryKey: ["server-metrics", serverId],
    queryFn: async () => {
      if (!serverId) return null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch("/api/linode/instances/metrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ serverId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch metrics");
      }

      return response.json();
    },
    enabled: !!serverId && !!userId,
    staleTime: 60 * 1000, // Metrics refresh every minute
    refetchInterval: 60 * 1000, // Auto-refetch every minute
  });
}

/**
 * Sync servers from Linode
 */
export function useSyncServers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch("/api/linode/instances/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to sync servers");
      }

      return response.json();
    },
    onSuccess: (data, userId) => {
      // Refetch servers after sync
      queryClient.invalidateQueries({ queryKey: ["servers", userId] });
    },
  });
}
