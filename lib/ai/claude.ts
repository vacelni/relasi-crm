import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

/**
 * The Claude API calls. Haiku is enough for short summaries, scoring, and extraction, and it
 * keeps a per-call cost low enough for a free plan quota. Low effort: these are single-step tasks.
 */
export const AI_MODEL = 'claude-haiku-5-5';
const MAX_TOKENS = 4000;

export class AiError extends Error {}

export type AiUsage = { input_tokens: number; output_tokens: number };

let client: Anthropic | null = null;

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 1, timeout: 45_000 });
  return client;
}

function checkStop(response: Anthropic.Message): void {
  if (response.stop_reason === 'refusal') {
    throw new AiError('The AI declined this request. Edit the notes and try again.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AiError('The AI answer was cut off. Try again with less text.');
  }
}

export async function generateText(system: string, input: string): Promise<{ text: string; usage: AiUsage }> {
  const response = await call(() =>
    anthropic().messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: input }],
    }),
  );
  checkStop(response);
  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
    .trim();
  if (!text) throw new AiError('The AI returned an empty answer. Try again.');
  return { text, usage: response.usage };
}

export async function generateObject<T extends z.ZodType>(
  system: string,
  input: string,
  schema: T,
): Promise<{ data: z.infer<T>; usage: AiUsage }> {
  const response = await call(() =>
    anthropic().messages.parse({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: 'low', format: zodOutputFormat(schema) },
      system,
      messages: [{ role: 'user', content: input }],
    }),
  );
  checkStop(response);
  if (response.parsed_output == null) throw new AiError('The AI returned an unexpected answer. Try again.');
  return { data: response.parsed_output as z.infer<T>, usage: response.usage };
}

/** Maps SDK errors to messages for the user; the details go to the server log. */
async function call<R>(request: () => Promise<R>): Promise<R> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof AiError) throw error;
    console.error('[ai]', error);
    if (error instanceof Anthropic.RateLimitError) throw new AiError('The AI service is busy. Try again in a minute.');
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new AiError('The AI service is not configured correctly. Ask the workspace owner.');
    }
    if (error instanceof Anthropic.APIConnectionError) throw new AiError('Could not reach the AI service. Try again.');
    if (error instanceof Anthropic.APIError) throw new AiError('The AI service returned an error. Try again.');
    // The SDK throws AnthropicError when the structured answer fails validation.
    if (error instanceof Anthropic.AnthropicError) throw new AiError('The AI returned an unexpected answer. Try again.');
    throw error;
  }
}
