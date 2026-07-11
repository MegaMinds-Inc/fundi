import { Injectable } from '@nestjs/common';
import type { AiProvider, AiCompletionRequest, AiCompletionResult } from './ai-provider.interface';

// TODO(ADR-011): concrete LLM provider SDK integration lands here only.
// No other module may import an LLM provider SDK directly — see the
// dependency-cruiser boundary rules (Sprint 0 Task 4).
@Injectable()
export class AiService implements AiProvider {
  async complete(_request: AiCompletionRequest): Promise<AiCompletionResult> {
    return { text: '' };
  }
}
