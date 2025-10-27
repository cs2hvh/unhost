import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FaServer, FaPowerOff, FaPlay, FaRedo, FaTrash, FaExternalLinkAlt, FaMapMarkerAlt } from "react-icons/fa";
import Image from "next/image";
import { getFlagUrl } from "@/lib/linode";
import type { Server } from "@/types";

interface ServerCardProps {
  server: Server;
  onPowerAction: (serverId: string, action: 'start' | 'stop' | 'reboot') => void;
  onDelete: (server: Server) => void;
  onViewDetails: (server: Server) => void;
  isPerformingAction: boolean;
}

export const ServerCard = memo(function ServerCard({ 
  server, 
  onPowerAction, 
  onDelete, 
  onViewDetails,
  isPerformingAction 
}: ServerCardProps) {
  const statusColors = {
    running: 'bg-green-500/20 text-green-400 border-green-500/30',
    stopped: 'bg-red-500/20 text-red-400 border-red-500/30',
    provisioning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    booting: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    rebooting: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    shutting_down: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };

  const canPerformPowerActions = !isPerformingAction && 
    server.status !== 'provisioning' && 
    server.status !== 'booting' && 
    server.status !== 'rebooting' && 
    server.status !== 'shutting_down';

  return (
    <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 hover:border-white/20 transition-all">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-white flex items-center gap-2">
              <FaServer className="h-5 w-5 text-blue-400" />
              {server.name}
            </CardTitle>
            <CardDescription className="text-white/60 mt-1">
              {server.ip || 'No IP assigned'}
            </CardDescription>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[server.status] || statusColors.offline}`}>
            {server.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Server Details */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-white/70">
            <FaMapMarkerAlt className="h-4 w-4 text-blue-400" />
            <span className="flex items-center gap-2">
              {server.location}
              {getFlagUrl(server.location) && (
                <Image
                  src={getFlagUrl(server.location)!}
                  alt={server.location}
                  width={20}
                  height={15}
                  className="rounded"
                />
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 text-white/70">
            <FaServer className="h-4 w-4 text-blue-400" />
            <span>{server.os}</span>
          </div>
          <div className="flex items-center gap-2 text-white/70">
            <span className="text-white/50">Plan:</span>
            <span className="text-white font-medium">{server.plan_type}</span>
          </div>
        </div>

        {/* Specs Grid */}
        {(server.cores || server.memory || server.disk) && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
            {server.cores && (
              <div className="text-center">
                <div className="text-xs text-white/50">vCPU</div>
                <div className="text-white font-semibold">{server.cores}</div>
              </div>
            )}
            {server.memory && (
              <div className="text-center">
                <div className="text-xs text-white/50">RAM</div>
                <div className="text-white font-semibold">{(server.memory / 1024).toFixed(0)} GB</div>
              </div>
            )}
            {server.disk && (
              <div className="text-center">
                <div className="text-xs text-white/50">Storage</div>
                <div className="text-white font-semibold">{(server.disk / 1024).toFixed(0)} GB</div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {server.status === 'running' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPowerAction(server.id, 'stop')}
                disabled={!canPerformPowerActions}
                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
              >
                <FaPowerOff className="h-3 w-3 mr-1" />
                Stop
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPowerAction(server.id, 'reboot')}
                disabled={!canPerformPowerActions}
                className="flex-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
              >
                <FaRedo className="h-3 w-3 mr-1" />
                Reboot
              </Button>
            </>
          )}
          {server.status === 'stopped' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPowerAction(server.id, 'start')}
              disabled={!canPerformPowerActions}
              className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30"
            >
              <FaPlay className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(server)}
            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30"
          >
            <FaExternalLinkAlt className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(server)}
            disabled={isPerformingAction}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
          >
            <FaTrash className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
