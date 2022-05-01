/*
 * SPDX-FileCopyrightText: 2022 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Decoder } from 'lib0/decoding';
import WebSocket from 'ws';
import { Awareness } from 'y-protocols/awareness';
import { Doc } from 'yjs';

import { Note } from '../../notes/note.entity';
import { WebsocketAwareness } from './websocket-awareness';
import { WebsocketConnection } from './websocket-connection';
import { WebsocketDoc } from './websocket-ydoc';

export class RealtimeNote {
  private readonly websocketDoc: WebsocketDoc;
  private readonly websocketAwareness: WebsocketAwareness;
  private readonly clients = new Map<WebSocket, WebsocketConnection>();

  constructor(private note: Note, initialContent: string) {
    this.websocketDoc = new WebsocketDoc(this, initialContent);
    this.websocketAwareness = new WebsocketAwareness(this);
  }

  public connectClient(client: WebSocket): void {
    const websocketConnection = new WebsocketConnection(client, this);
    this.clients.set(client, websocketConnection);
  }

  public processSyncMessage(client: WebSocket, decoder: Decoder): void {
    this.websocketDoc.processSyncMessage(client, decoder);
  }

  public processAwarenessMessage(client: WebSocket, decoder: Decoder): void {
    this.websocketAwareness.processAwarenessMessage(client, decoder);
  }

  /**
   * Disconnects the given websocket client while cleaning-up if it was the last user in the realtime note.
   *
   * @param {WebSocket} client The websocket client that disconnects.
   * @return {@code true} when the client was the last one in this realtime note, {@code false} otherwise.
   */
  public removeClient(client: WebSocket): void {
    this.clients.delete(client);
  }

  public hasNoClient(): boolean {
    return this.clients.size === 0;
  }

  public destroyNote(): void {
    this.websocketDoc.destroy();
  }

  /**
   * Returns the internal note id of this realtime note instance.
   *
   * @return The internal uuid of the note.
   */
  public getNote(): Note {
    return this.note;
  }

  public getWebsocketsExcept(client: WebSocket): WebSocket[] {
    const otherClients = new Set(this.clients.keys());
    otherClients.delete(client);
    return [...otherClients];
  }

  public getYDoc(): Doc {
    return this.websocketDoc.getYDoc();
  }

  public getAwareness(): Awareness {
    return this.websocketAwareness.getAwareness();
  }
}
