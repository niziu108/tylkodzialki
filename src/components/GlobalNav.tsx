'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import Logo from './Logo';

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

function HeartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PersonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <circle cx="12" cy="8" r="3.6" strokeWidth="2" />
      <path d="M4.5 20c0-3.6 3.4-5.6 7.5-5.6s7.5 2 7.5 5.6" strokeWidth="2" strokeLinecap="round" />
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
      if (!accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };

    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setAccountOpen(false);

    if (pathname !== href) {
      router.push(href);
    }
  };

  const goAuth = () => {
    setOpen(false);
    setAccountOpen(false);

    // Czyste /logowanie z menu (po zalogowaniu i tak ląduje się na /panel). callbackUrl
    // dokładamy tylko tam, gdzie powrót na konkretną stronę ma sens (middleware,
    // ulubione, autopublikacja oferty), żeby pasek adresu nie pokazywał ?callbackUrl=%2F.
    router.push('/logowanie');
  };

  const navBtnBase =
    'relative inline-flex h-[72px] items-center justify-center text-[15px] font-medium tracking-[0.01em] transition';

  const navBtnWhite =
    'text-fg/80 hover:text-fg after:absolute after:left-0 after:right-0 after:bottom-[20px] after:h-px after:origin-center after:scale-x-0 after:bg-fg/70 after:transition-transform after:duration-200 hover:after:scale-x-100';

  const navBtnGreen =
    'text-brand-text hover:text-brand-bright after:absolute after:left-0 after:right-0 after:bottom-[20px] after:h-px after:origin-center after:scale-x-0 after:bg-brand after:transition-transform after:duration-200 hover:after:scale-x-100';

  const linkMobile =
    'w-full py-5 text-[clamp(20px,5.5vw,28px)] font-medium leading-none text-fg transition-colors hover:text-brand-bright';

  const linkMobileGreen =
    'w-full py-5 text-[clamp(20px,5.5vw,28px)] font-medium leading-none text-brand-bright transition-colors hover:text-fg';

  return (
    <>
      <header className="global-nav sticky top-0 left-0 z-[100] w-full border-b border-fg/10 bg-bg backdrop-blur">
        <div className="flex h-[72px] w-full items-center justify-between px-4 sm:px-8">
          <button onClick={() => go('/')} className="flex items-center" aria-label="Strona główna">
            <Logo className="h-10 sm:h-12" />
          </button>

          <nav className="hidden items-center gap-10 md:flex">
            {isLogged ? (
              <button
                onClick={() => go('/ulubione')}
                className={`${navBtnBase} ${navBtnWhite} gap-2`}
                aria-label="Ulubione działki"
              >
                <HeartIcon className="h-4 w-4 text-brand-text" />
                <span>Ulubione</span>
              </button>
            ) : null}

            <button
              onClick={() => go('/')}
              className={`${navBtnBase} ${navBtnWhite}`}
            >
              Start
            </button>

            <button
              onClick={() => go('/kup')}
              className={`${navBtnBase} ${navBtnWhite}`}
            >
              Szukaj działki
            </button>

            <button
              onClick={() => go('/sprzedaj')}
              className={`${navBtnBase} ${navBtnWhite}`}
            >
              Dodaj ogłoszenie
            </button>

            <button
              onClick={() => go('/sprawdz-dzialke')}
              className={`${navBtnBase} ${navBtnWhite}`}
            >
              Sprawdź działkę
            </button>

            <button
              onClick={() => go('/dla-biur')}
              className={`${navBtnBase} ${navBtnWhite}`}
            >
              Dla biur
            </button>

            {!isLogged ? (
              <button
                onClick={goAuth}
                className={`${navBtnBase} ${navBtnGreen}`}
              >
                Zaloguj się
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
                  Moje konto
                </button>

                <AnimatePresence>
                  {accountOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16 }}
                      className="absolute right-0 top-[62px] w-60 overflow-hidden rounded-2xl border border-fg/12 bg-surface-2/95 shadow-[0_12px_40px_rgba(0,0,0,0.10)] backdrop-blur-md"
                    >
                      <div className="border-b border-fg/10 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-fg/68">
                          Zalogowano
                        </div>

                        <div className="mt-1 truncate text-[13px] text-fg/75">
                          {session?.user?.email ?? '—'}
                        </div>
                      </div>

                      <button
                        onClick={() => go('/panel')}
                        className="w-full px-4 py-3 text-left text-[13px] text-fg/80 transition hover:bg-fg/5 hover:text-fg"
                      >
                        Panel klienta
                      </button>

                      <button
                        onClick={() => {
                          setAccountOpen(false);
                          signOut({ callbackUrl: '/' });
                        }}
                        className="w-full px-4 py-3 text-left text-[13px] text-fg/80 transition hover:bg-fg/5 hover:text-fg"
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

      {isLogged ? (
        <button
          type="button"
          aria-label="Ulubione działki"
          onClick={() => go('/ulubione')}
          className="fixed right-[62px] top-4 z-[120] flex h-10 w-10 items-center justify-center text-brand-text md:hidden"
        >
          <HeartIcon className="h-5 w-5" />
        </button>
      ) : null}

      <button
        type="button"
        aria-label={isLogged ? 'Moje konto' : 'Zaloguj się lub zarejestruj'}
        onClick={() => (isLogged ? go('/panel') : goAuth())}
        className={`fixed ${isLogged ? 'right-[108px]' : 'right-[62px]'} top-4 z-[120] flex h-10 w-10 items-center justify-center text-fg/85 md:hidden`}
      >
        <PersonIcon className="h-[22px] w-[22px]" />
      </button>

      <motion.button
        aria-label={open ? 'Zamknij menu' : 'Otwórz menu'}
        onClick={() => setOpen((s) => !s)}
        className="fixed right-4 top-4 z-[120] flex h-10 w-10 items-center justify-center p-0 text-fg/85 md:hidden"
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="relative h-9 w-9">
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={false}
            animate={{ opacity: open ? 0 : 1 }}
          >
            <BurgerIcon className="h-7 w-7" />
          </motion.div>

          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={false}
            animate={{ opacity: open ? 1 : 0 }}
          >
            <CrossIcon className="h-7 w-7" />
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
            className="fixed inset-0 z-[110] flex flex-col bg-bg text-fg md:hidden"
          >
            <button
              aria-hidden
              onClick={() => setOpen(false)}
              className="absolute inset-0 -z-10"
            />

            <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 text-center">
              <Logo className="h-12" />

              <div className="flex w-full max-w-sm flex-col divide-y divide-fg/10">
                <button onClick={() => go('/')} className={linkMobile}>
                  Start
                </button>

                <button onClick={() => go('/kup')} className={linkMobile}>
                  Szukaj działki
                </button>

                <button onClick={() => go('/sprzedaj')} className={linkMobile}>
                  Dodaj ogłoszenie
                </button>

                <button onClick={() => go('/sprawdz-dzialke')} className={linkMobile}>
                  Sprawdź działkę
                </button>

                <button onClick={() => go('/dla-biur')} className={linkMobile}>
                  Dla biur
                </button>

                {!isLogged ? (
                  <button onClick={goAuth} className={linkMobileGreen}>
                    Zaloguj się
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => go('/panel')}
                      className={linkMobileGreen}
                    >
                      Panel klienta
                    </button>

                    <button
                      onClick={() => {
                        setOpen(false);
                        signOut({ callbackUrl: '/' });
                      }}
                      className={linkMobileGreen}
                    >
                      Wyloguj
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
