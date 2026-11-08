import './globals.css';

export const metadata = {
  title: 'Multi-Cloud Control Tower | Azure + AWS Zero-Cost Failover',
  description: 'Production-ready Next.js Multi-Cloud Failover Dashboard for Azure App Service (F1) and AWS Elastic Beanstalk (Single-Instance Node 20).',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}

