/*
 * SPDX-FileCopyrightText: 2021 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Column, Entity, ManyToOne } from 'typeorm';

import { Note } from '../notes/note.entity';
import { User } from '../users/user.entity';

@Entity()
export class NoteUserPermission {
  /**
   * The `user` and `note` properties cannot be converted to promises
   * (to lazy-load them), as TypeORM gets confused about lazy composite
   * primary keys.
   * See https://github.com/typeorm/typeorm/issues/6908
   */

  @ManyToOne((_) => User, {
    primary: true,
    onDelete: 'CASCADE', // This deletes the NoteUserPermission, when the associated Note is deleted
    orphanedRowAction: 'delete', // This ensures the whole row is deleted when the Permission stops being referenced
  })
  user: User;

  @ManyToOne((_) => Note, (note) => note.userPermissions, {
    primary: true,
    onDelete: 'CASCADE', // This deletes the NoteUserPermission, when the associated Note is deleted
    orphanedRowAction: 'delete', // This ensures the whole row is deleted when the Permission stops being referenced
  })
  note: Note;

  @Column()
  canEdit: boolean;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static create(
    user: User,
    note: Note,
    canEdit: boolean,
  ): NoteUserPermission {
    const userPermission = new NoteUserPermission();
    userPermission.user = user;
    userPermission.note = note;
    userPermission.canEdit = canEdit;
    return userPermission;
  }
}
