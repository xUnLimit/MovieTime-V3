/**
 * Site Configuration
 *
 * General site metadata and configuration.
 */

export const siteConfig = {
  name: 'MovieTime PTY',
  description: 'Sistema de gestiÃ³n de servicios de streaming en PanamÃ¡',
  url: 'http://localhost:3000',
  ogImage: '',
  links: {
    github: '',
    twitter: '',
  },
  creator: 'MovieTime PTY',
} as const;

export type SiteConfig = typeof siteConfig;
