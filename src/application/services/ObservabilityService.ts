export interface TraceEvent {
  action: 'upload' | 'chunking' | 'embedding' | 'vector_insert' | 'retrieval' | 'llm_generation' | 'auth_check';
  durationMs: number;
  metadata?: Record<string, any>;
  userId?: string;
  success: boolean;
  error?: string;
}

export class ObservabilityService {
  /**
   * Extremely lightweight tracer.
   * In a production enterprise system, this would push to OpenTelemetry/Datadog.
   * For now, it logs structured JSON to stdout.
   */
  async track(event: TraceEvent) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...event,
    };
    
    // Using stdout for structured logs
    console.log(JSON.stringify(logEntry));
  }

  async traceAsync<T>(
    action: TraceEvent['action'],
    userId: string | undefined,
    operation: () => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await operation();
      const durationMs = performance.now() - start;
      
      this.track({
        action,
        durationMs,
        metadata,
        userId,
        success: true
      });
      
      return result;
    } catch (error: any) {
      const durationMs = performance.now() - start;
      
      this.track({
        action,
        durationMs,
        metadata,
        userId,
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }
}
