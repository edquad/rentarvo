import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { config } from '../config/index.js';

let client: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (!client) {
    const opts: Record<string, any> = { region: config.bedrock.region };
    if (config.storage.s3.accessKeyId && config.storage.s3.secretAccessKey) {
      opts.credentials = {
        accessKeyId: config.storage.s3.accessKeyId,
        secretAccessKey: config.storage.s3.secretAccessKey,
      };
    }
    client = new BedrockRuntimeClient(opts);
  }
  return client;
}

export async function askBedrock(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2048,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const command = new InvokeModelCommand({
    modelId: config.bedrock.model,
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(body),
  });

  const response = await getClient().send(command);
  const parsed = JSON.parse(new TextDecoder().decode(response.body));
  return parsed.content?.[0]?.text ?? '';
}
