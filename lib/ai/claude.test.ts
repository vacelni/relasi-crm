import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { leadScoreSchema } from './schemas';

/**
 * The Claude calls against a local stand-in for the Messages API: checks the request we send
 * (model, effort, structured output schema) and how answers, refusals, and errors are handled.
 */

type Reply = { status: number; body: unknown };
let server: Server;
let requests: { path: string; body: Record<string, unknown> }[] = [];
let reply: Reply;

function message(content: unknown[], stop_reason = 'end_turn') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 812, output_tokens: 97 },
  };
}

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      requests.push({ path: req.url ?? '', body: JSON.parse(data || '{}') });
      res.writeHead(reply.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-fixture');
  vi.stubEnv('ANTHROPIC_BASE_URL', `http://127.0.0.1:${port}`);
});

afterAll(() => {
  vi.unstubAllEnvs();
  server.close();
});

beforeEach(() => {
  requests = [];
  vi.resetModules();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

async function claude() {
  return import('./claude');
}

describe('generateObject', () => {
  it('sends Haiku a low-effort request with the JSON schema and returns the validated object', async () => {
    const score = { score: 82, temperature: 'hot', reasons: ['Budget approved by partners'], next_step: 'Send the quotation' };
    reply = { status: 200, body: message([{ type: 'text', text: JSON.stringify(score) }]) };
    const { generateObject } = await claude();

    const result = await generateObject('system prompt', 'contact context', leadScoreSchema);

    expect(result).toEqual({ data: score, usage: expect.objectContaining({ input_tokens: 812, output_tokens: 97 }) });
    expect(requests).toHaveLength(1);
    const body = requests[0]!.body as { model: string; system: string; output_config: { effort: string; format: { type: string; schema: { properties: object } } } };
    expect(requests[0]!.path).toBe('/v1/messages');
    expect(body.model).toBe('claude-haiku-5-5');
    expect(body.system).toBe('system prompt');
    expect(body.output_config.effort).toBe('low');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(Object.keys(body.output_config.format.schema.properties)).toEqual(['score', 'temperature', 'reasons', 'next_step']);
  });

  it('rejects an answer that breaks the schema', async () => {
    reply = { status: 200, body: message([{ type: 'text', text: JSON.stringify({ score: 140, temperature: 'hot', reasons: [], next_step: '' }) }]) };
    const { generateObject } = await claude();
    await expect(generateObject('s', 'i', leadScoreSchema)).rejects.toThrow('The AI returned an unexpected answer. Try again.');
  });
});

describe('generateText', () => {
  it('joins the text blocks', async () => {
    reply = { status: 200, body: message([{ type: 'text', text: '- First point\n' }, { type: 'text', text: '- Second point' }]) };
    const { generateText } = await claude();
    expect((await generateText('s', 'i')).text).toBe('- First point\n- Second point');
  });

  it('reports a refusal instead of returning partial text', async () => {
    reply = { status: 200, body: message([], 'refusal') };
    const { generateText } = await claude();
    await expect(generateText('s', 'i')).rejects.toThrow('The AI declined this request.');
  });

  it('turns API errors into messages for the user', async () => {
    reply = { status: 429, body: { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } } };
    const { generateText } = await claude();
    await expect(generateText('s', 'i')).rejects.toThrow('The AI service is busy. Try again in a minute.');

    reply = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'bad key' } } };
    const again = await claude();
    await expect(again.generateText('s', 'i')).rejects.toThrow('The AI service is not configured correctly.');
  });
});
