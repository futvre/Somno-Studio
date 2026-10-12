import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Somno Studio | Ambient Audio Mixing Console',
  description: 'Minimalist professional ambient audio mixing console for deep sleep, focus, and meditation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="el" className="dark">
      <body className="bg-[#08090d] text-gray-100 h-screen overflow-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
