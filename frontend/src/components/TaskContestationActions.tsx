'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatEther } from 'ethers';
import { isLikelyUri } from '@sdk/index';
import { TaskStatus, type Task } from '@sdk/types';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useAgentSDK } from '@/hooks/useAgentSDK';
import { canClientDispute, canClientSettleConceded, getContestationTiming } from '@/lib/contestation';

interface TaskContestationActionsProps {
  task: Task;
  connectedAddress?: string;
  agentResponseWindowSec: bigint | null;
  disputeBondBps: bigint | null;
  onTaskUpdated?: () => Promise<void> | void;
}

function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null) return '-';
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remaining}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remaining}s`;
  }
  return `${remaining}s`;
}

function sameAddress(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export function TaskContestationActions({
  task,
  connectedAddress,
  agentResponseWindowSec,
  disputeBondBps,
  onTaskUpdated,
}: TaskContestationActionsProps) {
  const sdk = useAgentSDK();
  const [nowSec, setNowSec] = useState<number>(Math.floor(Date.now() / 1000));
  const [evidenceUri, setEvidenceUri] = useState<string>(task.clientEvidenceURI || '');
  const [isDisputing, setIsDisputing] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setEvidenceUri(task.clientEvidenceURI || '');
  }, [task.id, task.clientEvidenceURI]);

  const isTaskClient = sameAddress(task.client, connectedAddress);
  const responseWindow = agentResponseWindowSec ?? 0n;

  const timing = useMemo(() => {
    return getContestationTiming(task, nowSec, responseWindow);
  }, [task, nowSec, responseWindow]);

  const canDispute = useMemo(() => {
    return canClientDispute(task, nowSec, connectedAddress);
  }, [task, nowSec, connectedAddress]);

  const canSettleConceded = useMemo(() => {
    if (agentResponseWindowSec === null) return false;
    return canClientSettleConceded(task, nowSec, agentResponseWindowSec, connectedAddress);
  }, [task, nowSec, agentResponseWindowSec, connectedAddress]);

  const expectedDisputeBond = useMemo(() => {
    if (disputeBondBps === null) return null;
    return (task.paymentAmount * disputeBondBps) / 10000n;
  }, [task.paymentAmount, disputeBondBps]);

  const uriLooksValid = isLikelyUri(evidenceUri.trim());

  if (task.status !== TaskStatus.ResultAsserted && task.status !== TaskStatus.DisputedAwaitingAgent) {
    return null;
  }

  const handleDispute = async () => {
    if (!sdk) {
      toast.error('Connect wallet to submit dispute.');
      return;
    }

    if (!uriLooksValid) {
      toast.error('Enter a valid evidence URI (ipfs://, https://, http://, ar://).');
      return;
    }

    setIsDisputing(true);
    const toastId = toast.loading(`Submitting dispute for task ${task.id.toString()}...`);

    try {
      await sdk.client.disputeTask(task.id, evidenceUri.trim());
      toast.success('Task disputed. Waiting for agent response window.', { id: toastId });
      await onTaskUpdated?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Dispute failed: ${message}`, { id: toastId });
    } finally {
      setIsDisputing(false);
    }
  };

  const handleSettleConceded = async () => {
    if (!sdk) {
      toast.error('Connect wallet to settle.');
      return;
    }

    setIsSettling(true);
    const toastId = toast.loading(`Settling task ${task.id.toString()} (agent conceded)...`);

    try {
      await sdk.client.settleAgentConceded(task.id);
      toast.success('Task settled: client wins by agent concession.', { id: toastId });
      await onTaskUpdated?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Settle failed: ${message}`, { id: toastId });
    } finally {
      setIsSettling(false);
    }
  };

  const disputeDisabledReason = !isTaskClient
    ? 'Connect with the task client wallet to dispute.'
    : !canDispute
      ? timing.label
      : !uriLooksValid
        ? 'Provide a valid evidence URI before disputing.'
        : null;

  const settleDisabledReason = !isTaskClient
    ? 'Connect with the task client wallet to settle.'
    : agentResponseWindowSec === null
      ? 'Loading escrow timing...'
      : !canSettleConceded
        ? timing.label
        : null;

  return (
    <div className="space-y-3 rounded-xl border border-orange-400/30 bg-orange-950/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-orange-300">Contestation Controls</p>
          <p className="text-[10px] text-orange-100/70">Testing and demo actions for disputed completion handling.</p>
        </div>
        <div className="text-right text-[10px] text-orange-200/80">
          {timing.secondsRemaining !== null && (
            <p>{formatDuration(timing.secondsRemaining)} remaining</p>
          )}
        </div>
      </div>

      {expectedDisputeBond !== null && (
        <p className="text-[10px] text-orange-200/80">
          Expected dispute bond: <span className="font-mono text-orange-100">{formatEther(expectedDisputeBond)} TST</span>
        </p>
      )}

      {task.status === TaskStatus.ResultAsserted && (
        <div className="space-y-2">
          <Input
            value={evidenceUri}
            onChange={(event) => setEvidenceUri(event.target.value)}
            placeholder="ipfs://... or https://..."
            className="h-8 border-orange-500/40 bg-black/20 text-xs"
          />
          <button
            onClick={handleDispute}
            disabled={Boolean(disputeDisabledReason) || isDisputing}
            className="w-full rounded-lg bg-orange-400 px-3 py-2 text-xs font-bold text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDisputing ? 'Submitting Dispute...' : 'Dispute Result'}
          </button>
          {disputeDisabledReason && (
            <p className="text-[10px] text-orange-200/80">{disputeDisabledReason}</p>
          )}
        </div>
      )}

      {task.status === TaskStatus.DisputedAwaitingAgent && (
        <div className="space-y-2">
          <button
            onClick={handleSettleConceded}
            disabled={Boolean(settleDisabledReason) || isSettling}
            className="w-full rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSettling ? 'Settling...' : 'Settle Agent Conceded'}
          </button>
          {settleDisabledReason && (
            <p className="text-[10px] text-orange-200/80">{settleDisabledReason}</p>
          )}
        </div>
      )}
    </div>
  );
}
