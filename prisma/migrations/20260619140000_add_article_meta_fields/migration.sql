-- Dodanie pól meta artykułu (kategoria, czas czytania, SEO). Wszystkie nullable,
-- więc istniejące artykuły nie wymagają wartości domyślnych ani backfillu.
ALTER TABLE "Article" ADD COLUMN "category" TEXT;
ALTER TABLE "Article" ADD COLUMN "readingTime" INTEGER;
ALTER TABLE "Article" ADD COLUMN "seoTitle" TEXT;
ALTER TABLE "Article" ADD COLUMN "seoDescription" TEXT;
