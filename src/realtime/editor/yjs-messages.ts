/*
 * SPDX-FileCopyrightText: 2022 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { decoding } from 'lib0';
import { encoding } from 'lib0';
import { Decoder } from 'lib0/decoding';
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
} from 'y-protocols/awareness';
import { readSyncMessage, writeSyncStep1, writeUpdate } from 'y-protocols/sync';
import { Doc } from 'yjs';

import { WebsocketConnection } from './websocket-connection';

export enum MessageType {
  SYNC = 0,
  AWARENESS = 1,
  HEDGEDOC = 100,
}

export function encodeAwarenessMessage(
  awareness: Awareness,
  updatedClients?: number[],
): Uint8Array {
  const encoder = encoding.createEncoder();
  const clientIds = updatedClients ?? Array.from(awareness.getStates().keys());
  encoding.writeVarUint(encoder, MessageType.AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    encodeAwarenessUpdate(awareness, clientIds),
  );
  return encoding.toUint8Array(encoder);
}

export function encodeSyncMessage(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MessageType.SYNC);
  writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

export function encodeInitialSyncMessage(yDoc: Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MessageType.SYNC);
  writeSyncStep1(encoder, yDoc);
  return encoding.toUint8Array(encoder);
}

export function decodeSyncMessage(
  decoder: Decoder,
  yDoc: Doc,
  transactionOrigin: WebsocketConnection,
): Uint8Array | undefined {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MessageType.SYNC);
  readSyncMessage(decoder, encoder, yDoc, transactionOrigin);
  if (encoding.length(encoder) > 1) {
    return encoding.toUint8Array(encoder);
  }
}

export function decodeAwarenessMessage(
  awareness: Awareness,
  decoder: Decoder,
  origin: WebsocketConnection,
): void {
  applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), origin);
}
