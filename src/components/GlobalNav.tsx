'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';

const BG = '#131313';
const FG = '#d9d9d9';
const ACCENT = '#d9d9d9';

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
  const pathname = usePathname();
  const router = useRouter();
  const lastOverflow = useRef<string>('');

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
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    if (pathname !== href) router.push(href);
  };

  const linkDesktop =
    'font-display uppercase tracking-[0.20em] text-[12px] text-white/85 hover:text-white transition';

  const linkMobile =
    'font-display uppercase tracking-wide text-white text-[clamp(34px,9vw,60px)] hover:opacity-90 transition-opacity';

  return (
    <>
      <header className="sticky top-0 left-0 z-[100] w-full bg-[#131313] border-b border-white/10">
        <div className="w-full px-4 sm:px-8 h-[72px] flex items-center justify-between">
          <button onClick={() => go('/')} className="flex items-center">
            <Image
              src="/logo1.png"
              alt="TylkoDziałki"
              width={1024}
              height={253}
              priority
              className="h-10 sm:h-12 md:h-12 w-auto"
            />
          </button>

          <nav className="hidden md:flex items-center gap-16">
            <button onClick={() => go('/')} className={linkDesktop}>
              START
            </button>
            <button onClick={() => go('/kup')} className={linkDesktop}>
              KUP
            </button>
            <button onClick={() => go('/sprzedaj')} className={linkDesktop}>
              SPRZEDAJ
            </button>
            <button onClick={() => go('/kontakt')} className={linkDesktop}>
              KONTAKT
            </button>
          </nav>
        </div>
      </header>

      {/* BURGER — mobile */}
      <motion.button
        aria-label={open ? 'Zamknij menu' : 'Otwórz menu'}
        onClick={() => setOpen((s) => !s)}
        className="fixed top-3 right-4 z-[120] md:hidden p-2"
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ duration: 0.35 }}
        style={{ color: ACCENT }}
      >
        <div className="relative w-10 h-10">
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={false}
            animate={{ opacity: open ? 0 : 1 }}
          >
            <BurgerIcon className="w-9 h-9" />
          </motion.div>
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={false}
            animate={{ opacity: open ? 1 : 0 }}
          >
            <CrossIcon className="w-9 h-9" />
          </motion.div>
        </div>
      </motion.button>

      {/* OVERLAY mobile */}
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="fixed inset-0 z-[110] md:hidden flex flex-col"
            style={{ backgroundColor: BG, color: FG }}
          >
            <button aria-hidden onClick={() => setOpen(false)} className="absolute inset-0 -z-10" />

            <div className="flex-1 flex flex-col items-center justify-center gap-10 text-center px-6">
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
                  KUP
                </button>
                <button onClick={() => go('/sprzedaj')} className={linkMobile}>
                  SPRZEDAJ
                </button>
                <button onClick={() => go('/kontakt')} className={linkMobile}>
                  KONTAKT
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}