import { TaskStatus, type Task } from '@sdk/types';

function sameAddress(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function toBigInt(value: bigint | number): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

function clampSeconds(seconds: bigint): number {
  if (seconds <= 0n) return 0;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  return Number(seconds > max ? max : seconds);
}

export interface ContestationTiming {
  mode: 'dispute_window' | 'awaiting_agent_response' | 'ready_to_settle_conceded' | 'not_contestable';
  label: string;
  secondsRemaining: number | null;
  deadlineUnix: bigint | null;
}

export function canClientDispute(
  task: Task,
  nowSec: bigint | number,
  connectedAddress?: string | null
): boolean {
  if (!sameAddress(task.client, connectedAddress)) return false;
  if (task.status !== TaskStatus.ResultAsserted) return false;
  return toBigInt(nowSec) < task.cooldownEndsAt;
}

export function canClientSettleConceded(
  task: Task,
  nowSec: bigint | number,
  agentResponseWindowSec: bigint | number,
  connectedAddress?: string | null
): boolean {
  if (!sameAddress(task.client, connectedAddress)) return false;
  if (task.status !== TaskStatus.DisputedAwaitingAgent) return false;
  const settleAt = task.cooldownEndsAt + toBigInt(agentResponseWindowSec);
  return toBigInt(nowSec) >= settleAt;
}

export function getContestationTiming(
  task: Task,
  nowSec: bigint | number,
  agentResponseWindowSec: bigint | number
): ContestationTiming {
  const now = toBigInt(nowSec);

  if (task.status === TaskStatus.ResultAsserted) {
    const remaining = task.cooldownEndsAt - now;
    if (remaining > 0n) {
      return {
        mode: 'dispute_window',
        label: 'Dispute window is open',
        secondsRemaining: clampSeconds(remaining),
        deadlineUnix: task.cooldownEndsAt,
      };
    }
    return {
      mode: 'not_contestable',
      label: 'Dispute window has closed',
      secondsRemaining: 0,
      deadlineUnix: task.cooldownEndsAt,
    };
  }

  if (task.status === TaskStatus.DisputedAwaitingAgent) {
    const settleAt = task.cooldownEndsAt + toBigInt(agentResponseWindowSec);
    const remaining = settleAt - now;

    if (remaining > 0n) {
      return {
        mode: 'awaiting_agent_response',
        label: 'Waiting for agent escalation window to end',
        secondsRemaining: clampSeconds(remaining),
        deadlineUnix: settleAt,
      };
    }

    return {
      mode: 'ready_to_settle_conceded',
      label: 'Agent response window ended. You can settle now.',
      secondsRemaining: 0,
      deadlineUnix: settleAt,
    };
  }

  return {
    mode: 'not_contestable',
    label: 'Task is not in a contestable state',
    secondsRemaining: null,
    deadlineUnix: null,
  };
}
