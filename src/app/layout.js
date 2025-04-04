import { Inter } from 'next/font/google';
  import './globals.css';
  import { AuthProvider } from '@/contexts/AuthContext';

  const inter = Inter({ subsets: ['latin'] });

  export const metadata = {
    title: 'Personal Finance Tracker',
    description: 'Track your expenses and manage your budget',
  };

  export default function RootLayout({ children }) {
    return (
      <html lang="en">
        <body className={inter.className}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </body>
      </html>
    );
  }
