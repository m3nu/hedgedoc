/*
 * SPDX-FileCopyrightText: 2022 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { registerAs } from '@nestjs/config';

import { NoteConfig } from '../note.config';

export default registerAs(
  'noteConfig',
  (): NoteConfig => ({
    maxDocumentLength: 100000,
    forbiddenNoteIds: ['forbiddenNoteId'],
  }),
);
