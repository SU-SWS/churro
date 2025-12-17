import './globals.css';
import type { Metadata } from 'next';
import { Source_Sans_3, Source_Serif_4 } from 'next/font/google';
import localFont from 'next/font/local';
import { GlobalFooter } from '@/components/GlobalFooter/GlobalFooter';
import AuthenticatedHeader from '@/components/AuthenticatedHeader';
import { cnb } from 'cnbuilder';

const source_sans = Source_Sans_3({
  subsets: ['latin'],
  style: ['italic','normal'],
  display: 'swap',
  variable: '--font-source-sans',
});

const source_serif = Source_Serif_4({
  subsets: ['latin'],
  style: ['italic','normal'],
  display: 'swap',
  variable: '--font-source-serif',
});

const stanford = localFont({
  src: '../public/fonts/stanford.woff2',
  weight: '300',
  variable: '--font-stanford',
});

export const metadata: Metadata = {
  title: 'CHURRO',
  description: 'Dashboard for Acquia Views/Visits data',
  applicationName: 'Stanford University',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/vnd.microsoft.icon' },
      { url: 'https://www-media.stanford.edu/assets/favicon/favicon-196x196.png', sizes: '196x196', type: 'image/png' },
      { url: 'https://www-media.stanford.edu/assets/favicon/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: 'https://www-media.stanford.edu/assets/favicon/favicon-128.png', sizes: '128x128', type: 'image/png' },
      { url: 'https://www-media.stanford.edu/assets/favicon/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: 'https://www-media.stanford.edu/assets/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: 'https://www-media.stanford.edu/assets/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: 'https://www-media.stanford.edu/assets/favicon/apple-touch-icon-60x60.png', sizes: '60x60' },
      { url: 'https://www-media.stanford.edu/assets/favicon/apple-touch-icon-72x72.png', sizes: '72x72' },
      { url: 'https://www-media.stanford.edu/assets/favicon/apple-touch-icon-76x76.png', sizes: '76x76' },
      { url: 'https://www-media.stanford.edu/assets/favicon/apple-touch-icon-114x114.png', sizes: '114x114' },
      { url: 'https://www-media.stanford.edu/assets/favicon/apple-touch-icon-120x120.png', sizes: '120x120' },
      { url: 'https://www-media.stanford.edu/assets/favicon/apple-touch-icon-144x144.png', sizes: '144x144' },
      { url: 'https://www-media.stanford.edu/assets/favicon/apple-touch-icon-152x152.png', sizes: '152x152' },
      { url: 'https://www-media.stanford.edu/assets/favicon/apple-touch-icon-180x180.png', sizes: '180x180' },
    ],
    other: [
      { rel: 'mask-icon', url: 'https://www-media.stanford.edu/assets/favicon/safari-pinned-tab.svg', color: '#ffffff' },
    ],
  },
  other: {
    'msapplication-TileColor': '#FFFFFF',
    'msapplication-TileImage': 'https://www-media.stanford.edu/assets/favicon/mstile-144x144.png',
    'msapplication-square70x70logo': 'https://www-media.stanford.edu/assets/favicon/mstile-70x70.png',
    'msapplication-square150x150logo': 'https://www-media.stanford.edu/assets/favicon/mstile-150x150.png',
    'msapplication-square310x310logo': 'https://www-media.stanford.edu/assets/favicon/mstile-310x310.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en"
    className={cnb(
            source_sans.variable,
            source_serif.variable,
            stanford.variable,
          )}>
      <body className={cnb(
            source_sans.variable,
            source_serif.variable,
            stanford.variable,
          )}>
        <AuthenticatedHeader
          title="Cloud Hosting Usage Reporting with Recurring Output (CHURRO)"

        />
        <main>{children}</main>
        <GlobalFooter />
      </body>
    </html>
  );
}