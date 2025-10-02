import './globals.css';
import type { Metadata } from 'next';
import { Source_Sans_3, Source_Serif_4 } from 'next/font/google';
import localFont from 'next/font/local';
import { GlobalFooter } from '@/components/GlobalFooter/GlobalFooter';
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
  src: '../public/fonts/Stanford.woff2',
  weight: '300',
  variable: '--font-stanford',
});

export const metadata: Metadata = {
  title: 'CHURRO',
  description: 'Dashboard for Acquia Views/Visits data',
};

function StanfordHeader() {
  return (
    <header className="stanford-header">
      <div className="px-20 sm:px-30 md:px-50 lg:px-30 pt-5 pb-1 bg-cardinal-red">
        <a className="logo hocus:no-underline text-white hocus:text-white text-20 leading-none" href="https://www.stanford.edu">Stanford University</a></div>
      <div className="flex flex-col md:flex-row jusify-between items-center rs-p-0">
        <div className="rs-p-0">
          <span className="logo text-cardinal-red type-3">
            Stanford <br/> University
          </span>
        </div>

          <h1 className="text-4xl rs-p-0">Cloud Hosting Usage Reporting with Recurring Output (CHURRO)</h1>

      </div>
    </header>
  );
}

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
        <StanfordHeader />
        <main>{children}</main>
        <GlobalFooter />
        </body>
    </html>
  );
}