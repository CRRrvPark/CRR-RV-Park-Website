/**
 * Barrel export for all Puck section components.
 *
 * Import PUCK_SECTIONS as a record keyed by component name and merge it
 * into the Puck config's `components` field.
 *
 * withStyle() wraps every section's render so the `sectionId` (for
 * #anchor links) and the standard `styleFields` (margin, padding, border,
 * shadow, colors) flow onto each section's outermost element without every
 * section having to opt-in manually.
 */

import { cloneElement, isValidElement, type ReactElement } from 'react';
import type { ComponentConfig } from '@puckeditor/core';
import { computeStyle, type StyleProps } from '@lib/puck-style';

import {
  ImageBlock,
  HeroSection,
  TwoColumnSection,
  CardGridSection,
  SiteCardsSection,
  ExploreGridSection,
  ReviewsSection,
  CtaBannerSection,
  EventsWidgetSection,
  ReserveFormSection,
  RatesTableSection,
  FeatureListSection,
  AmenityGridSection,
  InterludeSection,
  TrustBarSection,
  RegionMapSection,
} from './sections';
import { ATOM_COMPONENTS } from './atoms';

function withStyle(cfg: ComponentConfig): ComponentConfig {
  const originalRender = cfg.render as any;
  if (!originalRender) return cfg;

  const wrappedRender = (props: any) => {
    const rendered = originalRender(props);
    if (!isValidElement(rendered)) return rendered;

    const styleProps: StyleProps = props ?? {};
    const computed = computeStyle(styleProps);
    const hasStyle = Object.keys(computed).length > 0;
    const sectionId = typeof styleProps.sectionId === 'string' && styleProps.sectionId.trim()
      ? styleProps.sectionId.trim()
      : undefined;

    if (!sectionId && !hasStyle) return rendered;

    const el = rendered as ReactElement<any>;
    const existingStyle = (el.props && el.props.style) || undefined;
    const nextProps: Record<string, unknown> = {};
    if (sectionId) nextProps.id = sectionId;
    if (hasStyle) nextProps.style = { ...existingStyle, ...computed };
    return cloneElement(el, nextProps);
  };

  return { ...cfg, render: wrappedRender as any };
}

export const PUCK_SECTIONS = {
  ImageBlock: withStyle(ImageBlock),
  HeroSection: withStyle(HeroSection),
  TwoColumnSection: withStyle(TwoColumnSection),
  CardGridSection: withStyle(CardGridSection),
  SiteCardsSection: withStyle(SiteCardsSection),
  ExploreGridSection: withStyle(ExploreGridSection),
  ReviewsSection: withStyle(ReviewsSection),
  CtaBannerSection: withStyle(CtaBannerSection),
  EventsWidgetSection: withStyle(EventsWidgetSection),
  ReserveFormSection: withStyle(ReserveFormSection),
  RatesTableSection: withStyle(RatesTableSection),
  FeatureListSection: withStyle(FeatureListSection),
  AmenityGridSection: withStyle(AmenityGridSection),
  InterludeSection: withStyle(InterludeSection),
  TrustBarSection: withStyle(TrustBarSection),
  RegionMapSection: withStyle(RegionMapSection),
  // V4 atoms — registered alongside sections so Puck's palette shows them.
  // Atoms intentionally bypass withStyle(): they have no sectionId / styleFields,
  // and style handling belongs to their parent section shell, not the atom.
  ...ATOM_COMPONENTS,
} as const;

export {
  ImageBlock,
  HeroSection,
  TwoColumnSection,
  CardGridSection,
  SiteCardsSection,
  ExploreGridSection,
  ReviewsSection,
  CtaBannerSection,
  EventsWidgetSection,
  ReserveFormSection,
  RatesTableSection,
  FeatureListSection,
  AmenityGridSection,
  InterludeSection,
  TrustBarSection,
  RegionMapSection,
};

export * from './atoms';

export { ErrorBoundary } from './ErrorBoundary';
