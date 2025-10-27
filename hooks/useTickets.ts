import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Ticket, TicketWithMessages, TicketMessage } from "@/types";

const supabase = createClient();

/**
 * Fetch all tickets for the current user
 */
export function useTickets(userId?: string) {
  return useQuery({
    queryKey: ["tickets", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch("/api/tickets", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch tickets");
      }

      const result = await response.json();
      return result.tickets as Ticket[];
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch a single ticket with messages
 */
export function useTicket(ticketId?: string, userId?: string) {
  return useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      if (!ticketId) return null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch ticket");
      }

      const result = await response.json();
      return result.ticket as TicketWithMessages;
    },
    enabled: !!ticketId && !!userId,
    staleTime: 15 * 1000, // Refresh more often for active tickets
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}

/**
 * Create a new ticket
 */
export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      subject: string;
      message: string;
      priority?: "low" | "medium" | "high" | "urgent";
      userId: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subject: data.subject,
          message: data.message,
          priority: data.priority || "medium",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create ticket");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate tickets list
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.userId] });
    },
  });
}

/**
 * Reply to a ticket
 */
export function useReplyToTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ticketId,
      message,
      userId,
    }: {
      ticketId: string;
      message: string;
      userId: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send message");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate specific ticket to refetch messages
      queryClient.invalidateQueries({ queryKey: ["ticket", variables.ticketId] });
      // Also invalidate tickets list to update status
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.userId] });
    },
  });
}

/**
 * Update ticket status (admin only)
 */
export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ticketId,
      status,
      priority,
    }: {
      ticketId: string;
      status?: "open" | "in_progress" | "waiting" | "resolved" | "closed";
      priority?: "low" | "medium" | "high" | "urgent";
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status, priority }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update ticket");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate both ticket detail and tickets list
      queryClient.invalidateQueries({ queryKey: ["ticket", variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}
