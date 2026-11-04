const unavailableProviders = new Map<string, number>();
export const unavailableToolInstruction = 'This endpoint cannot execute tool calls. No external search tool is available. Answer directly from reliable supplied context; explicitly state any current-verification gap. Never invent a search, source, current fact, or completed action.';
export function rememberUnavailableTools(key: string): void {
  if (unavailableProviders.size >= 200) unavailableProviders.delete(unavailableProviders.keys().next().value!);
  unavailableProviders.set(key, Date.now() + 300000);
}
export function unavailableToolsKnown(key: string): boolean {
  const until = unavailableProviders.get(key);
  if (!until) return false;
  if (until <= Date.now()) { unavailableProviders.delete(key); return false; }
  return true;
}
/** Close provider-requested tools that this text endpoint never offered/executed. */
export function unavailableToolResults(value: unknown): Record<string, unknown>[] | null {
  const message = value as { content?: unknown; tool_calls?: unknown } | undefined;
  const calls = message?.tool_calls;
  if (calls === undefined || (Array.isArray(calls) && calls.length === 0)) return null;
  if (!Array.isArray(calls) || calls.length > 16) throw Error('PROVIDER_TOOL_UNAVAILABLE');
  const valid = calls.map(call => {
    if (!call || call.type !== 'function' || typeof call.id !== 'string' ||
        !call.id || call.id.length > 200 || typeof call.function?.name !== 'string' ||
        !call.function.name || call.function.name.length > 200 ||
        typeof call.function.arguments !== 'string' || call.function.arguments.length > 65536)
      throw Error('PROVIDER_TOOL_UNAVAILABLE');
    return { id: call.id, type: 'function', function: { name: call.function.name, arguments: call.function.arguments } };
  });
  if (new Set(valid.map(call => call.id)).size !== valid.length) throw Error('PROVIDER_TOOL_UNAVAILABLE');
  return [
    { role: 'assistant', content: typeof message?.content === 'string' ? message.content : null, tool_calls: valid },
    ...valid.map(call => ({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({
      status: 'unavailable', executed: false,
      instruction: 'This endpoint did not offer this tool and did not execute it. No search or retrieval occurred. Do not request another tool. Give a direct final answer using reliable supplied context; if current verification is required, state that specific gap briefly. Never claim a search succeeded or invent current facts, sources, or completed actions.'
    }) }))
  ];
}
