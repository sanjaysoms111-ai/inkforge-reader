import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Inkforge Reader',
    short_name: 'Inkforge',
    description: 'Discover & Read AI Webtoons — installable with offline chapter reading',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#09090b',
    theme_color: '#e11d48',
    icons: [
      {
        src: '/icon-192.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
      },
      {
        src: '/icon-512.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
    ],
    categories: ['entertainment', 'books'],
    // Helpful shortcuts for PWA launcher
    shortcuts: [
      {
        name: 'Home',
        short_name: 'Home',
        description: 'Browse comics and continue reading',
        url: '/',
      },
    ],
  }
}
