import { ActionRequest, ToolArgs, ToolName } from '../src/core/contract';

let counter = 0;
export function mkAction<T extends ToolName>(tool: T, args: ToolArgs[T], extra: Partial<ActionRequest> = {}, now = 1_000_000): ActionRequest<T> {
  counter += 1;
  return {
    id: `test-action-${String(counter).padStart(4, '0')}`,
    tool,
    args,
    createdAt: now,
    expiresAt: now + 60_000,
    source: 'backend',
    ...extra,
  } as ActionRequest<T>;
}
