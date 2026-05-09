/**
 * Site Configuration
 *
 * General site metadata and configuration.
 */

export const siteConfig = {
  name: 'MovieTime PTY',
  description: 'Sistema de gestión de servicios de streaming en Panamá',
  url: 'http://localhost:3000',
  ogImage: '',
  themeColor: '#111111',
  backgroundColor: '#111111',
  links: {
    github: '',
    twitter: '',
  },
  creator: 'MovieTime PTY',
} as const;

export type SiteConfig = typeof siteConfig;
