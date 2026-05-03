export interface LlmProvider {
  complete(prompt: string, systemPrompt?: string): Promise<string>;
}

class MockLlmProvider implements LlmProvider {
  async complete(prompt: string): Promise<string> {
    return JSON.stringify({
      kind: 'EXPENSE',
      propertyId: null,
      propertyGuessText: null,
      amount: '0.00',
      date: new Date().toISOString().split('T')[0],
      categoryId: null,
      categoryGuessText: null,
      tenantId: null,
      contactId: null,
      contactGuessText: null,
      paymentMethod: null,
      notes: 'Mock response',
      confidence: 0.0,
      warnings: ['LLM provider not configured — using mock'],
    });
  }
}

let provider: LlmProvider = new MockLlmProvider();

export function setLlmProvider(p: LlmProvider): void {
  provider = p;
}

export function getLlmProvider(): LlmProvider {
  return provider;
}
