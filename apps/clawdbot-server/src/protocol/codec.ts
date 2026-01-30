/**
 * Protocol Codec - Encode/Decode messages to/from wire format
 */

import type { ProtocolEnvelope, ProtocolMessageType } from './types';

export class ProtocolCodecError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ProtocolCodecError';
  }
}

/**
 * Encode a protocol envelope to JSON string for transmission
 */
export function encode<T>(envelope: ProtocolEnvelope<T>): string {
  try {
    return JSON.stringify(envelope);
  } catch (error) {
    throw new ProtocolCodecError(
      'Failed to encode message',
      'ENCODE_ERROR',
      error
    );
  }
}

/**
 * Decode a JSON string to a protocol envelope
 */
export function decode(data: string | Buffer): ProtocolEnvelope {
  const str = typeof data === 'string' ? data : data.toString('utf-8');

  try {
    const parsed = JSON.parse(str);

    // Validate envelope structure
    if (!parsed || typeof parsed !== 'object') {
      throw new ProtocolCodecError(
        'Invalid message: not an object',
        'INVALID_FORMAT'
      );
    }

    if (parsed.version !== '1.0') {
      throw new ProtocolCodecError(
        `Unsupported protocol version: ${parsed.version}`,
        'VERSION_MISMATCH',
        { received: parsed.version, expected: '1.0' }
      );
    }

    if (!isValidMessageType(parsed.type)) {
      throw new ProtocolCodecError(
        `Unknown message type: ${parsed.type}`,
        'UNKNOWN_TYPE',
        { type: parsed.type }
      );
    }

    if (typeof parsed.sequence !== 'number') {
      throw new ProtocolCodecError(
        'Invalid sequence number',
        'INVALID_SEQUENCE',
        { sequence: parsed.sequence }
      );
    }

    return parsed as ProtocolEnvelope;
  } catch (error) {
    if (error instanceof ProtocolCodecError) {
      throw error;
    }
    throw new ProtocolCodecError(
      'Failed to decode message',
      'DECODE_ERROR',
      error
    );
  }
}

/**
 * Validate message type
 */
function isValidMessageType(type: unknown): type is ProtocolMessageType {
  const validTypes: ProtocolMessageType[] = [
    'chat.message',
    'message.ack',
    'bot.state',
    'streaming.chunk',
    'system.ping',
    'system.pong',
    'system.error',
  ];
  return typeof type === 'string' && validTypes.includes(type as ProtocolMessageType);
}

/**
 * Try to decode, returning null on failure instead of throwing
 */
export function tryDecode(data: string | Buffer): ProtocolEnvelope | null {
  try {
    return decode(data);
  } catch {
    return null;
  }
}
