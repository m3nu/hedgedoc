/*
 * SPDX-FileCopyrightText: 2021 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { parse as parseCookie } from 'cookie';
import { IncomingMessage } from 'http';
import { decoding } from 'lib0';
import WebSocket from 'ws';

import { ConsoleLoggerService } from '../../logger/console-logger.service';
import { Note } from '../../notes/note.entity';
import { NotesService } from '../../notes/notes.service';
import { PermissionsService } from '../../permissions/permissions.service';
import { SessionService } from '../../session/session.service';
import { UsersService } from '../../users/users.service';
import { HEDGEDOC_SESSION } from '../../utils/session';
import { RealtimeNote } from './realtime-note';
import { getNoteFromRealtimePath } from './utils/get-note-from-realtime-path';
import { MessageType } from './yjs-messages';

/**
 * Gateway implementing the realtime logic required for realtime note editing.
 */
@WebSocketGateway({ path: '/realtime/' })
export class RealtimeEditorGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private connectionToRealtimeNote = new Map<WebSocket, RealtimeNote>();
  private noteIdToRealtimeNote = new Map<string, RealtimeNote>();

  constructor(
    private readonly logger: ConsoleLoggerService,
    private noteService: NotesService,
    private userService: UsersService,
    private permissionsService: PermissionsService,
    private sessionService: SessionService,
  ) {
    this.logger.setContext(RealtimeEditorGateway.name);
  }

  /**
   * Handler that is called when a WebSocket client disconnects.
   * Removes the client from their Y.Doc, if they were part of any.
   * @param client The WebSocket client that disconnects.
   */
  handleDisconnect(client: WebSocket): void {
    const realtimeNote = this.connectionToRealtimeNote.get(client);
    if (!realtimeNote) {
      this.logger.log('Undefined realtime note for connection');
      return;
    }
    realtimeNote.removeClient(client, () => {
      this.connectionToRealtimeNote.delete(client);
      this.noteIdToRealtimeNote.delete(realtimeNote.getNoteId());
    });
  }

  /**
   * Handler that is called for each new WebSocket client connection.
   * Checks whether the requested URL path is valid, whether the requested note
   * exists and whether the requesting user has access to the note.
   * Closes the connection to the client if one of the conditions does not apply.
   *
   * @param client The WebSocket client object.
   * @param req The underlying HTTP request of the WebSocket connection.
   */
  async handleConnection(
    client: WebSocket,
    req: IncomingMessage,
  ): Promise<void> {
    this.logger.log(
      `New realtime connection from ${req.socket.remoteAddress ?? 'unknown'}`,
      'handleConnection',
    );
    client.binaryType = 'arraybuffer';
    client.on('error', (error) => {
      this.logger.error(
        'Error in websocket connection.',
        error.message,
        'handleConnection',
      );
      client.close();
    });

    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      this.logger.error(
        'Connection denied. No cookie header present.',
        '',
        'handleConnection',
      );
      client.close();
      return;
    }
    const sessionCookie = parseCookie(cookieHeader);
    const cookieContent = sessionCookie[HEDGEDOC_SESSION];

    // const unsignedCookieContent = unsign();
    // TODO Verify signature of cookie content
    if (!cookieContent) {
      this.logger.error(
        `No ${HEDGEDOC_SESSION} cookie found`,
        '',
        'handleConnection',
      );
      client.close();
      return;
    }
    const sessionId = cookieContent.slice(2).split('.')[0];
    try {
      const username = await this.sessionService.getUsernameFromSessionId(
        sessionId,
      );

      const user = await this.userService.getUserByUsername(username);
      const note = await getNoteFromRealtimePath(
        this.noteService,
        req.url ?? '',
      );

      if (!(await this.permissionsService.mayRead(user, note))) {
        this.logger.error(
          `Access denied to note '${note.id}' for user '${user.username}'`,
          '',
          'handleConnection',
        );
        client.close();
        return;
      }

      const realtimeNote = await this.getOrCreateRealtimeNote(note);
      this.connectionToRealtimeNote.set(client, realtimeNote);

      if (client.readyState !== WebSocket.OPEN) {
        this.logger.error(
          `Socket was closed before initialize`,
          '',
          'handleConnection',
        );
        client.close();
        return;
      }

      realtimeNote.connectClient(client);
      this.logger.debug(
        `Connection to note '${note.id}' (${note.publicId}) by user '${user.username}'`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Unknown error occurred while initializing: ${
          (error as Error).message
        }`,
        (error as Error).stack,
        'handleConnection',
      );
      client.close();
    }
  }

  private async getOrCreateRealtimeNote(note: Note): Promise<RealtimeNote> {
    const realtimeNote = this.noteIdToRealtimeNote.get(note.id);
    if (!realtimeNote) {
      const initialContent = await this.noteService.getNoteContent(note);
      const realtimeNote = new RealtimeNote(note.id, initialContent);
      this.noteIdToRealtimeNote.set(note.id, realtimeNote);
      return realtimeNote;
    } else {
      return realtimeNote;
    }
  }

  /**
   * Handler that is called when a SYNC message is received from a WebSocket client.
   * SYNC messages are part of the Y-js protocol, containing changes on the note.
   * @param client The WebSocket client that sent the message.
   * @param decoder The decoder instance for decoding the message payload.
   * @returns void If no response should be sent for this request back to the client.
   * @returns Uint8Array Binary data that should be sent as a response to the message back to the client.
   */
  @SubscribeMessage(MessageType.SYNC)
  handleMessageSync(client: WebSocket, decoder: decoding.Decoder): void {
    this.connectionToRealtimeNote
      .get(client)
      ?.processSyncMessage(client, decoder);
  }

  /**
   * Handler that is called when a AWARENESS message is received from a WebSocket client.
   * AWARENESS messages are part of the Y-js protocol, containing e.g. the cursor states.
   * @param client The WebSocket client that sent the message.
   * @param decoder The decoder instance for decoding the message payload.
   * @returns void If no response should be send for this request back to the client.
   * @returns Uint8Array Binary data that should be send as a response to the message back to the client.
   */
  @SubscribeMessage(MessageType.AWARENESS)
  handleMessageAwareness(client: WebSocket, decoder: decoding.Decoder): void {
    this.connectionToRealtimeNote
      .get(client)
      ?.processAwarenessMessage(client, decoder);
  }

  /**
   * Handler that is called when a HEDGEDOC message is received from a WebSocket client.
   * HEDGEDOC messages are custom messages containing other real-time important information like permission changes.
   * @param client The WebSocket client that sent the message.
   * @param decoder The decoder instance for decoding the message payload.
   * @returns void If no response should be send for this request back to the client.
   * @returns Uint8Array Binary data that should be send as a response to the message back to the client.
   */
  @SubscribeMessage(MessageType.HEDGEDOC)
  handleMessageHedgeDoc(client: WebSocket, decoder: decoding.Decoder): void {
    this.logger.debug('Received HEDGEDOC message. Not implemented yet.');
  }
}
