/**
 * LLM integration via Replicate API.
 * Primary: anthropic/claude-4.5-sonnet
 * Fallback: deepseek-ai/deepseek-r1
 */

const REPLICATE_API = 'https://api.replicate.com/v1/models';

function getToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN not set in environment');
  return token;
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: any;
  error?: string;
  urls?: { get: string };
}

async function createPrediction(model: string, input: Record<string, any>): Promise<ReplicatePrediction> {
  const token = getToken();
  const res = await fetch(`${REPLICATE_API}/${model}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Replicate create prediction failed (${res.status}): ${err}`);
  }
  return res.json() as Promise<ReplicatePrediction>;
}

async function waitForPrediction(prediction: ReplicatePrediction, maxWaitMs = 120000): Promise<string> {
  const token = getToken();
  const getUrl = prediction.urls?.get;
  if (!getUrl) throw new Error('No get URL in prediction response');

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 2000)); // Poll every 2s

    const res = await fetch(getUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Replicate poll failed: ${res.status}`);

    const data = await res.json() as ReplicatePrediction;

    if (data.status === 'succeeded') {
      // Output format varies by model
      if (typeof data.output === 'string') return data.output;
      if (Array.isArray(data.output)) return data.output.join('');
      return JSON.stringify(data.output);
    }
    if (data.status === 'failed') {
      throw new Error(`Replicate prediction failed: ${data.error || 'unknown'}`);
    }
    if (data.status === 'canceled') {
      throw new Error('Replicate prediction was canceled');
    }
  }
  throw new Error(`Replicate prediction timed out after ${maxWaitMs}ms`);
}

/**
 * Call Claude 4.5 Sonnet via Replicate for signal identification and reasoning.
 */
export async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  console.log('  [LLM] Calling Claude 4.5 Sonnet via Replicate...');
  const prediction = await createPrediction('anthropic/claude-4.5-sonnet', {
    prompt: userPrompt,
    system_prompt: systemPrompt,
    max_tokens: 4096,
    max_image_resolution: 0.5,
  });
  return waitForPrediction(prediction);
}

/**
 * Call DeepSeek R1 via Replicate for deep reasoning tasks.
 */
export async function callDeepSeek(prompt: string): Promise<string> {
  console.log('  [LLM] Calling DeepSeek R1 via Replicate...');
  const prediction = await createPrediction('deepseek-ai/deepseek-r1', {
    prompt,
    top_p: 1,
    max_tokens: 8192,
    temperature: 0.1,
    presence_penalty: 0,
    frequency_penalty: 0,
  });
  return waitForPrediction(prediction);
}

/**
 * Primary LLM call — tries Claude first, falls back to DeepSeek with retry.
 */
export async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  // Try Claude first
  try {
    return await callClaude(systemPrompt, userPrompt);
  } catch (err) {
    console.log(`  [LLM] Claude failed: ${err}`);
  }

  // Try DeepSeek with retry on rate limit
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`  [LLM] Retry ${attempt}/2 after 12s wait...`);
        await new Promise(r => setTimeout(r, 12000));
      }
      return await callDeepSeek(`${systemPrompt}\n\n${userPrompt}`);
    } catch (err: any) {
      const isRateLimit = err.message?.includes('429') || err.message?.includes('throttled');
      if (!isRateLimit || attempt === 2) {
        throw err;
      }
    }
  }
  throw new Error('All LLM attempts failed');
}
