/**
 * @heynxt/agent-adapter — SSE Build Event Streaming
 *
 * Emits structured events during pipeline execution so that a
 * client can render real-time build progress via Server-Sent Events.
 */

/** ------------------------------------------------------------------ */
/*  Types                                                             */
/** ------------------------------------------------------------------ */

export interface BuildEvent {
  step: string;
  status: 'running' | 'done' | 'warning' | 'error';
  detail: string;
  elapsed_ms: number;
}

/** ------------------------------------------------------------------ */
/*  Emitter                                                           */
/** ------------------------------------------------------------------ */

export class BuildEventEmitter extends EventTarget {
  private startTime = Date.now();
  private controller: ReadableStreamDefaultController<string> | null = null;
  private closed = false;

  /** Buffered events for persistence — callers can read this to save to DB. */
  readonly buffer: BuildEvent[] = [];

  /** Optional callback invoked on every event (used to flush to DB). */
  onEvent?: (event: BuildEvent) => void;

  /** Emit a build event with the given step name and status. */
  emit(step: string, status: BuildEvent['status'], detail: string): void {
    const event: BuildEvent = {
      step,
      status,
      detail,
      elapsed_ms: Date.now() - this.startTime,
    };

    this.buffer.push(event);
    this.onEvent?.(event);

    // Guard: don't dispatch if the stream is already closed (client disconnected)
    if (!this.closed) {
      try {
        this.dispatchEvent(
          new CustomEvent<BuildEvent>('build', { detail: event }),
        );
      } catch {
        // Stream controller may have been closed by the client — swallow
        this.closed = true;
      }
    }
  }

  /** Close the underlying ReadableStream so the client knows the SSE is done. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.controller?.close();
    } catch {
      // Already closed — swallow
    }
    this.controller = null;
  }

  /**
   * Return a `ReadableStream<string>` that yields SSE-formatted lines
   * (`data: {...}\n\n`) for every `build` event dispatched on this emitter.
   */
  toReadableStream(): ReadableStream<string> {
    const stream = new ReadableStream<string>({
      start: (c) => {
        this.controller = c;
      },
      cancel: () => {
        // Client disconnected — mark as closed so emit() stops trying
        this.closed = true;
        this.controller = null;
      },
    });

    this.addEventListener('build', (e) => {
      if (this.closed) return;
      const { detail } = e as CustomEvent<BuildEvent>;
      try {
        this.controller?.enqueue(`data: ${JSON.stringify(detail)}\n\n`);
      } catch {
        // Controller already closed — swallow
        this.closed = true;
        this.controller = null;
      }
    });

    return stream;
  }
}
