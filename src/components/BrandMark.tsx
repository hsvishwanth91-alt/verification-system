import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export function CertiTrustMark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M16 2.5L4.5 7.2V15.4C4.5 22.4 9.4 28.6 16 30.2C22.6 28.6 27.5 22.4 27.5 15.4V7.2L16 2.5Z"
          fill={dark ? '#0D9488' : '#0B1F3A'}
        />
        <path
          d="M16 5.4L7.4 8.9V15.2C7.4 20.6 11.1 25.5 16 27C20.9 25.5 24.6 20.6 24.6 15.2V8.9L16 5.4Z"
          stroke={dark ? '#FFFFFF' : '#14B8A6'}
          strokeWidth="1.5"
        />
        <path
          d="M11.8 15.8L14.7 18.7L20.6 12.6"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={`font-display text-lg font-bold tracking-tight ${
          dark ? 'text-white' : 'text-navy-900'
        }`}
      >
        CertiTrust
      </span>
    </span>
  );
}

export function TopNavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: 'Verify', to: '/verify' },
    { label: 'How It Works', to: '/#how-it-works' },
    { label: 'Security', to: '/#security' },
    { label: 'Student Login', to: '/student/login' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <Link
          to="/"
          className="focus-visible:outline-2 focus-visible:outline-teal-600 rounded-md"
        >
          <CertiTrustMark />
        </Link>

        {/* Zone 2: 4 Single-line Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          {navLinks.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-navy-900 hover:underline underline-offset-4 ${
                  isActive ? 'text-navy-900 font-semibold' : ''
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action + Mobile Menu Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/admin/login"
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          >
            Admin Login
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 min-h-[40px] min-w-[40px]"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-navy-900"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/admin/login"
            onClick={() => setMobileOpen(false)}
            className="block rounded-lg bg-navy-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-navy-800"
          >
            Admin Login
          </Link>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <CertiTrustMark />
          <p className="text-sm text-slate-500 max-w-md">
            Digital Certificate Verification System for academic institutions, registrars, graduates, and employers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
          <Link to="/verify" className="hover:text-navy-900 whitespace-nowrap">
            Verify Credential
          </Link>
          <Link to="/student/login" className="hover:text-navy-900 whitespace-nowrap">
            Student Portal
          </Link>
          <Link to="/admin/login" className="hover:text-navy-900 whitespace-nowrap">
            Administrator Login
          </Link>
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>CertiTrust Academic Credential Registry · SHA-256 & QR Verified</span>
          <span>Only credentials confirmed against an authorized issuing institution are marked valid.</span>
        </div>
      </div>
    </footer>
  );
}
