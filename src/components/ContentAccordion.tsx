import React from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./ui/accordion";
import { FAQAccordion } from "./FAQAccordion";

interface ContentAccordionProps {
  faq: Array<{ q: string; a: string }>;
}

export function ContentAccordion({ faq }: ContentAccordionProps) {
  return (
    <Accordion type="single" collapsible defaultValue="how-it-works">
      <AccordionItem value="how-it-works" class="border-none">
        <AccordionTrigger class="rounded-t-xl text-sm font-semibold uppercase tracking-wide px-5 py-4 bg-surface-dark">
          How it works + FAQ
        </AccordionTrigger>
        <AccordionContent class="border-t border-border-dark">
          <div class="grid gap-8 lg:grid-cols-2 p-5">
            <section>
              <h2 class="text-sm font-semibold uppercase tracking-wider text-primary" aria-label="How it works">
                How it works
              </h2>

              <p class="mt-3 text-sm text-gray-300">
                Use Playlist Time to plan study sessions, courses, or binge-watching by converting playlist length into real watch-time
                estimates at multiple speeds.
              </p>

              <ol class="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-300">
                <li>
                  <span class="font-medium text-gray-100">Paste playlist links or IDs</span> — add one or many (new line, comma, or space separated).
                </li>
                <li>
                  <span class="font-medium text-gray-100">Optional: set a Default Range</span> — apply Start/End to newly added playlists (great for large courses).
                </li>
                <li>
                  <span class="font-medium text-gray-100">Click Analyze</span> — we sum video durations and build a comparison table.
                </li>
                <li>
                  <span class="font-medium text-gray-100">Fine-tune per playlist</span> — adjust Start/End in each row to measure only the videos you care about.
                </li>
                <li>
                  <span class="font-medium text-gray-100">Compare speeds instantly</span> — see totals at 1x, 1.25x, 1.5x, 1.75x, and your Custom speed.
                </li>
              </ol>

              <p class="mt-4 text-xs text-gray-400">
                Note: totals can change if videos become unavailable (private/deleted/region-blocked) or if a playlist is updated after analysis.
              </p>
            </section>

            <section>
              <h2 class="text-sm font-semibold uppercase tracking-wider text-primary" aria-label="Frequently asked questions">
                Frequently asked questions
              </h2>

              <FAQAccordion items={faq} />
            </section>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
