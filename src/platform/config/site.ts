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
  themeColor: '#0a0a0a',
  themeColorLight: '#fafafa',
  backgroundColor: '#0a0a0a',
  links: {
    github: '',
    twitter: '',
  },
  creator: 'MovieTime PTY',
} as const;
