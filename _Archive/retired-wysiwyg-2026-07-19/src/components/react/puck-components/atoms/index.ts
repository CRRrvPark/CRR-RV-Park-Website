/**
 * V4 block-level atoms — individually clickable units in the visual editor.
 *
 * Each atom is its own Puck ComponentConfig. Sections are refactored into
 * layout shells that expose DropZones; editors click an atom and see just
 * that atom's fields in the right panel.
 *
 * `ATOM_COMPONENTS` is the map consumed by puck-config.tsx to register
 * atoms alongside sections. `ATOM_NAMES` is the string list useful for
 * `DropZone allow={...}` restrictions on section shells.
 */

import type { ComponentConfig } from '@puckeditor/core';
import { EditableHeading } from './EditableHeading';
import { EditableRichText } from './EditableRichText';
import { EditableButton } from './EditableButton';
import { EditableImage } from './EditableImage';
import { EditableEyebrow } from './EditableEyebrow';

export const ATOM_COMPONENTS: Record<string, ComponentConfig<any>> = {
  EditableHeading,
  EditableRichText,
  EditableButton,
  EditableImage,
  EditableEyebrow,
};

export const ATOM_NAMES = Object.keys(ATOM_COMPONENTS) as Array<keyof typeof ATOM_COMPONENTS>;

export {
  EditableHeading,
  EditableRichText,
  EditableButton,
  EditableImage,
  EditableEyebrow,
};
