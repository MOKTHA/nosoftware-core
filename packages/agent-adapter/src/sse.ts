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

  /** Emit a build event with the given step name and status. */
  emit(step: string, status: BuildEvent['status'], detail: string): void {
    this.dispatchEvent(
      new CustomEvent<BuildEvent>('build', {
        detail: {
          step,
          status,
          detail,
          elapsed_ms: Date.now() - this.startTime,
        },
      }),
    );
  }

  /** Close the underlying ReadableStream so the client knows the SSE is done. */
  close(): void {
    this.controller?.close();
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
    });

    this.addEventListener('build', (e) => {
      const { detail } = e as CustomEvent<BuildEvent>;
      this.controller?.enqueue(`data: ${JSON.stringify(detail)}\n\n`);
    });

    return stream;
  }
}
