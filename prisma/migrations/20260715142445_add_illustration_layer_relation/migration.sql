-- AddForeignKey
ALTER TABLE "UnlockedIllustration" ADD CONSTRAINT "UnlockedIllustration_illustrationLayerId_fkey" FOREIGN KEY ("illustrationLayerId") REFERENCES "IllustrationLayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
