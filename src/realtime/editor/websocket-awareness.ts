/*
 * SPDX-FileCopyrightText: 2022 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { decoding, encoding } from 'lib0';
import { Decoder } from 'lib0/decoding';
import WebSocket from 'ws';
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
} from 'y-protocols/awareness';

import { MessageType } from './message-type';
import { RealtimeNote } from './realtime-note';

interface ClientIdUpdate {
  added: number[];
  updated: number[];
  removed: number[];
}

export class WebsocketAwareness {
  private readonly awareness: Awareness;

  constructor(private realtimeNote: RealtimeNote) {
    this.awareness = new Awareness(realtimeNote.getYDoc());
    this.awareness.setLocalState(null);
    this.awareness.on('update', this.handleAwarenessUpdate.bind(this));
  }

  public getAwareness(): Awareness {
    return this.awareness;
  }

  private handleAwarenessUpdate(
    { added, updated, removed }: ClientIdUpdate,
    origin: WebSocket,
  ): void {
    const changedClients = [...added, ...updated, ...removed];
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MessageType.AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      encodeAwarenessUpdate(this.awareness, changedClients),
    );
    const binaryUpdate = encoding.toUint8Array(encoder);
    this.realtimeNote
      .getWebsocketsExcept(origin)
      .forEach((client) => client.send(binaryUpdate));
  }

  public processAwarenessMessage(client: WebSocket, decoder: Decoder): void {
    applyAwarenessUpdate(
      this.awareness,
      decoding.readVarUint8Array(decoder),
      client,
    );
  }
}
