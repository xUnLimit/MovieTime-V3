/**
 * Site Configuration
 *
 * General site metadata and configuration.
 */

export const siteConfig = {
  name: 'MovieTime PTY',
  description: 'Sistema de gestión de servicios de streaming en Panamá',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ogImage: '',
  themeColor: '#262626',
  backgroundColor: '#262626',
  links: {
    github: '',
    twitter: '',
  },
  creator: 'MovieTime PTY',
} as const;

export type SiteConfig = typeof siteConfig;
