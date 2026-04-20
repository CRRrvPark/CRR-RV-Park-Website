/**
 * EditableImage — block-level image atom for the V4 visual editor.
 *
 * Click an image anywhere on the page → only the image fields appear in
 * the right panel (source, alt, size, fit, radius, caption, link).
 *
 * Uses the existing MediaPickerField (Supabase storage browser + URL paste),
 * so editor UX is consistent with the V3.1 image fields.
 *
 * Kept intentionally close to the existing ImageBlock component's field set;
 * migrating future sections that embed images into atom form is a direct
 * prop-to-prop mapping.
 */

import type { ComponentConfig } from '@puckeditor/core';
import { MediaPickerField } from '../fields/MediaPickerField';
import { linkPickerField } from '../fields/LinkPickerField';

export interface EditableImageProps {
  imageUrl?: string;
  alt?: string;
  width?: number;
  height?: number;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  borderRadius?: number;
  linkUrl?: string;
  className?: string;
}

export const EditableImage: ComponentConfig = {
  label: 'Image',
  defaultProps: {
    imageUrl: '',
    alt: '',
    width: 0,
    height: 0,
    objectFit: 'cover',
    borderRadius: 0,
    linkUrl: '',
    className: '',
  },
  fields: {
    imageUrl: { type: 'custom', label: 'Image', render: MediaPickerField as any },
    alt: { type: 'text', label: 'Alt text' },
    width: { type: 'number', label: 'Width (px, 0 = auto)', min: 0, max: 4000 },
    height: { type: 'number', label: 'Height (px, 0 = auto)', min: 0, max: 4000 },
    objectFit: {
      type: 'select',
      label: 'Object fit',
      options: [
        { label: 'Cover', value: 'cover' },
        { label: 'Contain', value: 'contain' },
        { label: 'Fill', value: 'fill' },
        { label: 'None (original)', value: 'none' },
      ],
    },
    borderRadius: { type: 'number', label: 'Border radius (px)', min: 0, max: 200 },
    linkUrl: linkPickerField('Link URL (optional)'),
    className: { type: 'text', label: 'CSS class (optional)' },
  },
  render: ({ imageUrl, alt, width, height, objectFit, borderRadius, linkUrl, className, puck }: any) => {
    const style: React.CSSProperties = {
      display: 'block',
      maxWidth: '100%',
    };
    if (width) style.width = `${width}px`;
    if (height) style.height = `${height}px`;
    if (objectFit) style.objectFit = objectFit;
    if (borderRadius) style.borderRadius = `${borderRadius}px`;

    const img = imageUrl ? (
      <img src={imageUrl} alt={alt || ''} loading="lazy" className={className || undefined} style={style} />
    ) : (
      <div
        style={{
          width: width || 300,
          height: height || 200,
          background: 'var(--sand, #f5f0e6)',
          border: '2px dashed var(--c-border, #e5e5e5)',
          borderRadius: borderRadius ? `${borderRadius}px` : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--c-muted, #888)',
          fontSize: '0.85rem',
        }}
      >
        Select an image
      </div>
    );

    const wrapped = linkUrl ? <a href={linkUrl}>{img}</a> : img;

    return <span ref={puck?.dragRef} style={{ display: 'inline-block' }}>{wrapped}</span>;
  },
};
