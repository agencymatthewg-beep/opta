import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

type ResizeListener = () => void;

const resizeSubscribers = new WeakMap<NodeJS.WriteStream, Set<ResizeListener>>();
const resizeHandlers = new WeakMap<NodeJS.WriteStream, ResizeListener>();
const resizePollers = new WeakMap<NodeJS.WriteStream, NodeJS.Timeout>();

function parseEnvInt(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function pickFirstPositive(values: Array<number | undefined>): number | undefined {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  }
  return undefined;
}

export function resolveSize(stdout: NodeJS.WriteStream | undefined): { width: number; height: number } {
  const width = pickFirstPositive([
    stdout?.columns,
    process.stdout.columns,
    parseEnvInt('COLUMNS'),
  ]);

  const height = pickFirstPositive([
    stdout?.rows,
    process.stdout.rows,
    parseEnvInt('LINES'),
  ]);

  return {
    width: width ?? 80,
    height: height ?? 24,
  };
}

function subscribeToStreamResize(stream: NodeJS.WriteStream, listener: ResizeListener): () => void {
  let subscribers = resizeSubscribers.get(stream);
  if (!subscribers) {
    subscribers = new Set();
    resizeSubscribers.set(stream, subscribers);
  }
  subscribers.add(listener);

  if (!resizeHandlers.has(stream)) {
    const notify: ResizeListener = () => {
      const active = resizeSubscribers.get(stream);
      if (!active) return;
      for (const subscriber of active) subscriber();
    };
    resizeHandlers.set(stream, notify);
    stream.on('resize', notify);
    resizePollers.set(stream, setInterval(notify, 750));
  }

  return () => {
    const active = resizeSubscribers.get(stream);
    if (!active) return;
    active.delete(listener);
    if (active.size > 0) return;

    resizeSubscribers.delete(stream);
    const handler = resizeHandlers.get(stream);
    if (handler) {
      stream.off('resize', handler);
      resizeHandlers.delete(stream);
    }
    const poll = resizePollers.get(stream);
    if (poll) {
      clearInterval(poll);
      resizePollers.delete(stream);
    }
  };
}

export function useTerminalSize(): { width: number; height: number } {
  const { stdout } = useStdout();

  const [size, setSize] = useState(() => resolveSize(stdout));

  useEffect(() => {
    const handleResize = () => {
      setSize(resolveSize(stdout));
    };

    const streams = [stdout, process.stdout]
      .filter((stream): stream is NodeJS.WriteStream => Boolean(stream));
    const uniqueStreams = Array.from(new Set(streams));

    handleResize();
    const unsubscribers = uniqueStreams.map((stream) => subscribeToStreamResize(stream, handleResize));

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [stdout]);

  return size;
}
