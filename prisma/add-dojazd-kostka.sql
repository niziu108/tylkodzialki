-- Kostka brukowa jako osobna kategoria dojazdu (wcześniej wpadała do ASFALT).
-- IF NOT EXISTS, bo Restore bazy Neona po cichu kasuje wartości enuma dodane przez ALTER TYPE
-- i skrypt musi dać się bezpiecznie powtórzyć.
ALTER TYPE "DojazdStatus" ADD VALUE IF NOT EXISTS 'KOSTKA' AFTER 'ASFALT';
