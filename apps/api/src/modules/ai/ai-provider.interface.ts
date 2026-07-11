export interface AiCompletionRequest {
  prompt: string;
}

export interface AiCompletionResult {
  text: string;
}

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
