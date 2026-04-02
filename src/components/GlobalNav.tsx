'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const BG = '#131313';
const FG = '#d9d9d9';
const GREEN = '#7aa333';

function BurgerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M3 6h18M3 12h18M3 18h18" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CrossIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function GlobalNav() {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  const pathname = usePathname();
  const router = useRouter();
  const lastOverflow = useRef<string>('');

  const { status, data: session } = useSession();
  const isLogged = status === 'authenticated';

  useEffect(() => {
    if (!open) return;
    lastOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = lastOverflow.current;
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!accountRef.current) return;
      if (!accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.location.hash === '#footer') {
      const footer = document.getElementById('footer');
      if (footer) {
        setTimeout(() => {
          footer.scrollIntoView({ behavior: 'smooth' });
        }, 80);
      }
    }
  }, [pathname]);

  const go = (href: string) => {
    setOpen(false);
    setAccountOpen(false);
    if (pathname !== href) router.push(href);
  };

  const goAuth = () => {
    setOpen(false);
    setAccountOpen(false);
    const cb = encodeURIComponent(pathname || '/');
    router.push(`/auth?callbackUrl=${cb}`);
  };

  const goToFooter = () => {
    setOpen(false);
    setAccountOpen(false);

    if (pathname !== '/') {
      router.push('/#footer');
      return;
    }

    const footer = document.getElementById('footer');
    if (footer) {
      footer.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navBtnBase =
    'relative inline-flex h-[72px] items-center justify-center font-display uppercase tracking-[0.20em] text-[12px] transition';

  const navBtnWhite =
    'text-white/85 hover:text-white after:absolute after:left-0 after:right-0 after:bottom-[18px] after:h-px after:origin-center after:scale-x-0 after:bg-white/70 after:transition-transform after:duration-200 hover:after:scale-x-100';

  const navBtnGreen =
    'text-[#7aa333] hover:text-[#9fd14b] after:absolute after:left-0 after:right-0 after:bottom-[18px] after:h-px after:origin-center after:scale-x-0 after:bg-[#7aa333] after:transition-transform after:duration-200 hover:after:scale-x-100';

  const linkMobile =
    'font-display uppercase tracking-wide text-white text-[clamp(34px,9vw,60px)] hover:opacity-90 transition-opacity';

  return (
    <>
      <header className="sticky top-0 left-0 z-[100] w-full border-b border-white/10 bg-[#131313]">
        <div className="flex h-[72px] w-full items-center justify-between px-4 sm:px-8">
          <button onClick={() => go('/')} className="flex items-center">
            <Image
              src="/logo1.png"
              alt="TylkoDziałki"
              width={1024}
              height={253}
              priority
              className="h-10 w-auto sm:h-12 md:h-12"
            />
          </button>

          <nav className="hidden items-center gap-14 md:flex">
            <button onClick={() => go('/')} className={`${navBtnBase} ${navBtnWhite}`}>
              START
            </button>

            <button onClick={() => go('/kup')} className={`${navBtnBase} ${navBtnWhite}`}>
              SZUKAJ DZIAŁKI
            </button>

            <button onClick={() => go('/sprzedaj')} className={`${navBtnBase} ${navBtnWhite}`}>
              SPRZEDAJ
            </button>

            <button onClick={goToFooter} className={`${navBtnBase} ${navBtnWhite}`}>
              KONTAKT
            </button>

            {!isLogged ? (
              <button onClick={goAuth} className={`${navBtnBase} ${navBtnGreen}`}>
                ZALOGUJ / REJESTRACJA
              </button>
            ) : (
              <div
                ref={accountRef}
                className="relative flex h-[72px] items-center"
                onMouseEnter={() => setAccountOpen(true)}
                onMouseLeave={() => setAccountOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className={`${navBtnBase} ${navBtnGreen}`}
                >
                  MOJE KONTO
                </button>

                <AnimatePresence>
                  {accountOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16 }}
                      className="absolute right-0 top-[62px] w-60 overflow-hidden rounded-2xl border border-white/12 bg-[#0f0f0f]/95 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md"
                    >
                      <div className="border-b border-white/10 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                          Zalogowano
                        </div>
                        <div className="mt-1 truncate text-[13px] text-white/75">
                          {session?.user?.email ?? '—'}
                        </div>
                      </div>

                      <button
                        onClick={() => go('/panel')}
                        className="w-full px-4 py-3 text-left text-[13px] text-white/80 transition hover:bg-white/5 hover:text-white"
                      >
                        Panel klienta
                      </button>

                      <button
                        onClick={() => {
                          setAccountOpen(false);
                          signOut({ callbackUrl: '/' });
                        }}
                        className="w-full px-4 py-3 text-left text-[13px] text-white/80 transition hover:bg-white/5 hover:text-white"
                      >
                        Wyloguj
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </nav>
        </div>
      </header>

      <motion.button
        aria-label={open ? 'Zamknij menu' : 'Otwórz menu'}
        onClick={() => setOpen((s) => !s)}
        className="fixed top-3 right-4 z-[120] p-2 md:hidden"
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ duration: 0.35 }}
        style={{ color: FG }}
      >
        <div className="relative h-10 w-10">
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={false}
            animate={{ opacity: open ? 0 : 1 }}
          >
            <BurgerIcon className="h-9 w-9" />
          </motion.div>
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={false}
            animate={{ opacity: open ? 1 : 0 }}
          >
            <CrossIcon className="h-9 w-9" />
          </motion.div>
        </div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="fixed inset-0 z-[110] flex flex-col md:hidden"
            style={{ backgroundColor: BG, color: FG }}
          >
            <button aria-hidden onClick={() => setOpen(false)} className="absolute inset-0 -z-10" />

            <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 text-center">
              <Image
                src="/logo.png"
                alt="TylkoDziałki"
                width={1024}
                height={253}
                priority
                className="h-16 w-auto"
              />

              <div className="flex flex-col gap-8">
                <button onClick={() => go('/')} className={linkMobile}>
                  START
                </button>
                <button onClick={() => go('/kup')} className={linkMobile}>
                  SZUKAJ DZIAŁKI
                </button>
                <button onClick={() => go('/sprzedaj')} className={linkMobile}>
                  SPRZEDAJ
                </button>
                <button onClick={goToFooter} className={linkMobile}>
                  KONTAKT
                </button>

                {!isLogged ? (
                  <button onClick={goAuth} className={linkMobile} style={{ color: GREEN }}>
                    ZALOGUJ / REJESTRACJA
                  </button>
                ) : (
                  <>
                    <button onClick={() => go('/panel')} className={linkMobile} style={{ color: GREEN }}>
                      PANEL KLIENTA
                    </button>
                    <button
                      onClick={() => {
                        setOpen(false);
                        signOut({ callbackUrl: '/' });
                      }}
                      className={linkMobile}
                      style={{ color: GREEN }}
                    >
                      WYLOGUJ
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}