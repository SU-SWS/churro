import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Acquia API Dashboard',
  description: 'Dashboard for visualizing Acquia API data',
};

function StanfordHeader() {
  return (
    <header className="stanford-header">
      <div className="su-brand-bar su-brand-bar--bright">
        <div className="su-brand-bar__container">
          <a className="su-brand-bar__logo" href="https://stanford.edu">Stanford University</a>
        </div>
      </div>
      <div className="stanford-header-bar">
        <div className="su-lockup__wordmark-wrapper">
          <span className="su-lockup__wordmark text-mint-500">Stanford</span>
        </div>
        <div className="stanford-header-title">
          <span>Cloud Hosting Usage Reporting with Recurring Output (CHURRO)</span>
        </div>
      </div>
    </header>
  );
}

function StanfordFooter() {
  return (
    <footer className="stanford-footer">
      <div className="stanford-footer-bar">
        <div>
          <a href="https://www.stanford.edu/" target="_blank" rel="noopener noreferrer" className="stanford-footer-link">
            Stanford University
          </a>
        </div>
        <div className="stanford-footer-copy">
          &copy; {new Date().getFullYear()} Stanford University | Stanford Web Services
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StanfordHeader />
        <main>{children}</main>
        <StanfordFooter />
        </body>
    </html>
  );
}