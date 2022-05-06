/*
 * SPDX-FileCopyrightText: 2022 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Logger } from '@nestjs/common';
import { websocket } from 'lib0';
import { Decoder } from 'lib0/decoding';
import WebSocket from 'ws';
import { Awareness } from 'y-protocols/awareness';
import { Doc } from 'yjs';

import { WebsocketAwareness } from './websocket-awareness';
import { WebsocketConnection } from './websocket-connection';
import { WebsocketDoc } from './websocket-ydoc';

export class RealtimeNote {
  protected readonly logger = new Logger(RealtimeNote.name);
  private readonly websocketDoc: WebsocketDoc;
  private readonly websocketAwareness: WebsocketAwareness;
  private readonly clients = new Map<WebSocket, WebsocketConnection>();

  constructor(private readonly noteId: string, initialContent: string) {
    this.websocketDoc = new WebsocketDoc(this, initialContent);
    this.websocketAwareness = new WebsocketAwareness(this);
    this.logger.log(`New realtime note for ${noteId} created.`);
  }

  public connectClient(client: WebSocket): void {
    this.logger.log(`New client connected`);
    this.clients.set(client, new WebsocketConnection(client, this));
  }

  public processSyncMessage(client: WebSocket, decoder: Decoder): void {
    const connection = this.clients.get(client);
    if (!connection) {
      throw new Error('Received SYNC for unknown connection');
    }
    this.websocketDoc.processSyncMessage(connection, decoder);
  }

  public processAwarenessMessage(client: WebSocket, decoder: Decoder): void {
    const connection = this.clients.get(client);
    if (!connection) {
      throw new Error('Received AWARENESS for unknown connection');
    }
    this.websocketAwareness.processAwarenessMessage(connection, decoder);
  }

  /**
   * Disconnects the given websocket client while cleaning-up if it was the last user in the realtime note.
   *
   * @param {WebSocket} client The websocket client that disconnects.
   * @param {() => void} onDestroy Will be executed if the realtime note is empty and should be deleted.
   * @return {@code true} when the client was the last one in this realtime note, {@code false} otherwise.
   */
  public removeClient(client: WebSocket, onDestroy: () => void): void {
    this.clients.delete(client);

    this.logger.log(`Client disconnected. ${this.clients.size} left.`);
    if (!this.hasConnections()) {
      this.logger.log(`No more connections left. Destroying yDoc.`);
      this.websocketDoc.destroy();
      onDestroy();
    }
  }

  public hasConnections(): boolean {
    return this.clients.size !== 0;
  }

  /**
   * Returns the internal note id of this realtime note instance.
   *
   * @return The internal uuid of the note.
   */
  public getNoteId(): string {
    return this.noteId;
  }

  public getConnections(): WebsocketConnection[] {
    return [...this.clients.values()];
  }

  public getYDoc(): Doc {
    return this.websocketDoc;
  }

  public getAwareness(): Awareness {
    return this.websocketAwareness;
  }
}
