import { describe, expect, it, vi } from 'vitest';
import { createAiProviderRegistry, type AiProvider } from './ai-provider.ts';

const createFakeProvider = (name = 'google-agent-platform'): AiProvider => ({
  name: name as AiProvider['name'],
  async *streamTutor() {
    yield 'bonjour';
  },
  async generateJson() {
    return { ok: true };
  },
  async transcribe() {
    return { segments: [] };
  },
  async synthesize() {
    return { audio: new Uint8Array([1]), mimeType: 'audio/wav' };
  },
});

describe('AI provider registry', () => {
  it('returns the explicitly registered Google provider', () => {
    const google = createFakeProvider();
    const registry = createAiProviderRegistry([google]);

    expect(registry.get('google-agent-platform')).toBe(google);
    expect(registry.names()).toEqual(['google-agent-platform']);
  });

  it('fails closed for an unknown provider without calling any provider method', async () => {
    const method = vi.fn();
    const google: AiProvider = {
      ...createFakeProvider(),
      streamTutor: method,
      generateJson: method,
      transcribe: method,
      synthesize: method,
    };
    const registry = createAiProviderRegistry([google]);

    expect(() => registry.get('openai-compatible')).toThrowError(expect.objectContaining({ code: 'unsupported_provider' }));
    expect(method).not.toHaveBeenCalled();
  });

  it('does not substitute another provider when Google is absent', () => {
    const registry = createAiProviderRegistry([]);

    expect(() => registry.get('google-agent-platform')).toThrowError(expect.objectContaining({ code: 'provider_unavailable' }));
    expect(registry.names()).toEqual([]);
  });

  it('rejects attempts to register an unsupported provider', () => {
    expect(() => createAiProviderRegistry([createFakeProvider('azure')])).toThrowError(
      expect.objectContaining({ code: 'unsupported_provider' }),
    );
  });

  it('rejects duplicate Google registrations instead of selecting one implicitly', () => {
    expect(() => createAiProviderRegistry([createFakeProvider(), createFakeProvider()])).toThrowError(
      expect.objectContaining({ code: 'duplicate_provider' }),
    );
  });
});
