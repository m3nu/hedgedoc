/*
 * SPDX-FileCopyrightText: 2022 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { encoding } from 'lib0';
import { Decoder } from 'lib0/decoding';
import WebSocket from 'ws';
import { readSyncMessage, writeUpdate } from 'y-protocols/sync';
import { Doc } from 'yjs';

import { MessageType } from './message-type';
import { RealtimeNote } from './realtime-note';

export class WebsocketDoc {
  private readonly yDoc: Doc;

  constructor(private realtimeNote: RealtimeNote, initialContent: string) {
    this.yDoc = new Doc();
    this.yDoc.getText('codemirror').insert(0, initialContent);
    this.yDoc.on('update', this.processYDocUpdate.bind(this));
  }

  public getYDoc(): Doc {
    return this.yDoc;
  }

  private processYDocUpdate(update: Uint8Array, origin: WebSocket): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MessageType.SYNC);
    writeUpdate(encoder, update);
    const binaryUpdate = encoding.toUint8Array(encoder);
    this.realtimeNote
      .getWebsocketsExcept(origin)
      .forEach((client) => client.send(binaryUpdate));
  }

  public processSyncMessage(client: WebSocket, decoder: Decoder): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MessageType.SYNC);
    readSyncMessage(decoder, encoder, this.yDoc, null);
    if (encoding.length(encoder) > 1) {
      client.send(encoding.toUint8Array(encoder));
    }
  }

  public destroy(): void {
    this.yDoc.destroy();
  }
}
