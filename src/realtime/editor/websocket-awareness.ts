/*
 * SPDX-FileCopyrightText: 2022 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { decoding } from 'lib0';
import { Decoder } from 'lib0/decoding';
import { Awareness, removeAwarenessStates } from 'y-protocols/awareness';

import { RealtimeNote } from './realtime-note';
import { WebsocketConnection } from './websocket-connection';
import { decodeAwarenessMessage, encodeAwarenessMessage } from './yjs-messages';

interface ClientIdUpdate {
  added: number[];
  updated: number[];
  removed: number[];
}

export class WebsocketAwareness extends Awareness {
  constructor(private realtimeNote: RealtimeNote) {
    super(realtimeNote.getYDoc());
    this.setLocalState(null);
    this.on('update', this.handleAwarenessUpdate.bind(this));
  }

  private handleAwarenessUpdate(
    { added, updated, removed }: ClientIdUpdate,
    origin: WebsocketConnection,
  ): void {
    if (origin) {
      const controlledAwarenessIds = origin.getControlledAwarenessIds();
      added.forEach((addId) => controlledAwarenessIds.add(addId));
      removed.forEach((removedId) => controlledAwarenessIds.add(removedId));
    }
    const binaryUpdate = encodeAwarenessMessage(this, [
      ...added,
      ...updated,
      ...removed,
    ]);
    this.realtimeNote
      .getConnections()
      .forEach((client) => client.send(binaryUpdate));
  }

  public processAwarenessMessage(
    client: WebsocketConnection,
    decoder: Decoder,
  ): void {
    decodeAwarenessMessage(this, decoder, client);
  }

  public removeClient(websocketConnection: WebsocketConnection): void {
    removeAwarenessStates(
      this,
      Array.from(websocketConnection.getControlledAwarenessIds()),
      null,
    );
  }
}
