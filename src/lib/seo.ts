/**
 * Site-wide search metadata and structured-data helpers.
 *
 * Keep public identity, canonical host, and breadcrumb hierarchy here so
 * sitemap, metadata, and JSON-LD cannot quietly drift apart.
 */

export const SITE_ORIGIN = 'https://crookedriverranchrv.com';
export const SITE_NAME = 'Crooked River Ranch RV Park';
export const SITE_ALTERNATE_NAME = 'CRR RV Park';
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/images/aerial_canyon_rim.jpg`;
export const RV_PARK_ID = `${SITE_ORIGIN}/#rv-park`;
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
export const GOOGLE_MAPS_URL = 'https://www.google.com/maps?cid=4960049674782183446';

export interface BreadcrumbItem {
  name: string;
  href?: string;
}

export function absoluteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/^https:\/\/www\.crookedriverranchrv\.com/i, SITE_ORIGIN);
  }
  return new URL(value.startsWith('/') ? value : `/${value}`, `${SITE_ORIGIN}/`).toString();
}

export function canonicalUrl(value: string): string {
  const url = new URL(absoluteUrl(value));
  url.hash = '';
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

const STATIC_BREADCRUMBS: Record<string, string> = {
  '/amenities': 'Park amenities',
  '/area-guide': 'Park + area guide',
  '/availability': 'Live availability',
  '/book-now': 'Plan your visit',
  '/dining': 'Dining & local',
  '/events': 'Events',
  '/extended-stays': 'Extended stays',
  '/golf-course': 'Golf course',
  '/golf-stays': 'Golf stays',
  '/group-sites': 'Group stays',
  '/park-map': 'Park map',
  '/park-policies': 'Park policies',
  '/privacy': 'Privacy policy',
  '/sites': 'Sites & site types',
  '/terms': 'Website terms',
  '/things-to-do': 'Things to do',
  '/trails': 'Trails',
};

export function breadcrumbsForPath(pathname: string, title: string): BreadcrumbItem[] {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path.startsWith('/admin')) return [];

  if (path.startsWith('/sites/')) {
    return [
      { name: 'Sites & site types', href: '/sites' },
      { name: title.split(' · ')[0] || 'Site details' },
    ];
  }

  if (path.startsWith('/trails/')) {
    return [
      { name: 'Trails', href: '/trails' },
      { name: title.split(' Trail Guide')[0] || 'Trail guide' },
    ];
  }

  if (path.startsWith('/things-to-do/')) {
    return [
      { name: 'Things to do', href: '/things-to-do' },
      { name: title.split(' | ')[0] || 'Activity details' },
    ];
  }

  const label = STATIC_BREADCRUMBS[path];
  return label ? [{ name: label }] : [];
}

export function webPageSchema(
  title: string,
  description: string,
  canonical: string,
  ogImage?: string,
): Record<string, unknown> {
  const pageUrl = canonicalUrl(canonical);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: title,
    description,
    inLanguage: 'en-US',
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': RV_PARK_ID },
    ...(ogImage
      ? {
          primaryImageOfPage: {
            '@type': 'ImageObject',
            url: absoluteUrl(ogImage),
          },
        }
      : {}),
  };
}

export function breadcrumbSchema(
  breadcrumbs: BreadcrumbItem[],
  canonical: string,
): Record<string, unknown> | null {
  if (breadcrumbs.length === 0) return null;
  const pageUrl = canonicalUrl(canonical);
  const items = [
    { name: 'Home', href: '/' },
    ...breadcrumbs,
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: index === items.length - 1
        ? pageUrl
        : absoluteUrl(item.href ?? '/'),
    })),
  };
}

export const RV_PARK_SCHEMA: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'Campground',
  '@id': RV_PARK_ID,
  name: SITE_NAME,
  alternateName: SITE_ALTERNATE_NAME,
  description: 'Year-round RV park on the Crooked River canyon rim in Terrebonne, Oregon, with full-hookup sites, a heated seasonal pool, and an adjacent golf course.',
  url: SITE_ORIGIN,
  telephone: '+1-541-923-1441',
  email: 'rvpark@crookedriverranch.com',
  image: [
    `${SITE_ORIGIN}/images/aerial_canyon_rim.jpg`,
    `${SITE_ORIGIN}/images/canyon_sunset.jpg`,
    `${SITE_ORIGIN}/images/pool_aerial.jpg`,
  ],
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_ORIGIN}/images/crr-rv-park-logo.png`,
    width: 225,
    height: 193,
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: '14875 SW Hays Lane',
    addressLocality: 'Terrebonne',
    addressRegion: 'OR',
    postalCode: '97760',
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 44.4271235,
    longitude: -121.2387995,
  },
  hasMap: GOOGLE_MAPS_URL,
  checkinTime: '14:00',
  checkoutTime: '12:00',
  petsAllowed: true,
  sameAs: [
    GOOGLE_MAPS_URL,
    'https://www.crookedriverranch.com/crooked-river-ranch-rv-park',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+1-541-923-1441',
    contactType: 'reservations',
    areaServed: 'US',
    availableLanguage: 'English',
  },
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'Full-hookup RV sites', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Pull-through RV sites', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Heated seasonal pool', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Off-leash dog area', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Free showers', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Wi-Fi', value: true },
  ],
};

export const WEBSITE_SCHEMA: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: SITE_ORIGIN,
  name: SITE_NAME,
  alternateName: SITE_ALTERNATE_NAME,
  inLanguage: 'en-US',
  publisher: { '@id': RV_PARK_ID },
};
