-- Droga leśna jako osobna kategoria (wcześniej wpadała do GRUNTOWA).
-- IF NOT EXISTS, bo Restore bazy Neona kasuje wartości enuma dodane przez ALTER TYPE.
ALTER TYPE "DojazdStatus" ADD VALUE IF NOT EXISTS 'LESNA' AFTER 'GRUNTOWA';
