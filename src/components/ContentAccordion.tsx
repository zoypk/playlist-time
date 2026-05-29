import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./ui/accordion";
import { FAQAccordion } from "./FAQAccordion";

interface Step {
  title: string;
  detail: string;
}

interface Feature {
  title: string;
  detail: string;
}

interface ContentAccordionProps {
  faq: Array<{ q: string; a: string }>;
  howItWorks: Step[];
  features: Feature[];
  whyUse: string;
}

export function ContentAccordion({ faq, howItWorks, features, whyUse }: ContentAccordionProps) {
  return (
    <Accordion type="single" collapsible defaultValue="how-it-works">
      <AccordionItem value="how-it-works" className="border-none">
        <AccordionTrigger className="rounded-t-lg bg-surface-dark px-5 py-4 text-sm font-semibold">
          How it works + FAQ
        </AccordionTrigger>
        <AccordionContent className="border-t border-border-dark">
          <div className="space-y-10 p-5">

            {/* ── Introduction ── */}
            <section>
              <h2 className="text-sm font-semibold text-primary">
                What is Playlist Time?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">
                Playlist Time is a free <strong>YouTube Playlist Length Calculator</strong> that tells you exactly how long any playlist takes to watch. Whether you need to plan study sessions around a lecture series, schedule time for an online course, or simply find out how long a music compilation runs, this tool gives you an instant answer. Enter one or more playlist links and get the <strong>total YouTube playlist time</strong> broken down by playback speed — 1x, 1.25x, 1.5x, 1.75x, or any custom rate you prefer.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                Unlike manually scrolling through every video to add up durations, our <strong>YouTube playlist length calculator</strong> does the math for you in seconds. It also handles partial playlists: set a start and end range to calculate the duration of only the videos you actually plan to watch.
              </p>
            </section>

            {/* ── How It Works ── */}
            <section>
              <h2 className="text-sm font-semibold text-primary">
                How to Calculate YouTube Playlist Duration
              </h2>
              <p className="mt-3 text-sm text-gray-300">
                Use this <strong>online playlist calculator</strong> to convert playlist length into real watch-time estimates in just a few steps:
              </p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-300">
                {howItWorks.map((step, i) => (
                  <li key={i}>
                    <span className="font-medium text-gray-100">{step.title}</span> — {step.detail}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-gray-400">
                Note: totals can change if videos become unavailable (private/deleted/region-blocked) or if a playlist is updated after analysis.
              </p>
            </section>

            {/* ── Features / Benefits ── */}
            <section>
              <h2 className="text-sm font-semibold text-primary">
                Features &amp; Benefits
              </h2>
              <ul className="mt-4 space-y-2 pl-5 text-sm text-gray-300 list-disc">
                {features.map((feat, i) => (
                  <li key={i}>
                    <span className="font-medium text-gray-100">{feat.title}</span> — {feat.detail}
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Why Use This Tool ── */}
            <section>
              <h2 className="text-sm font-semibold text-primary">
                Why Use This Playlist Watch Time Calculator?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">
                {whyUse}
              </p>
            </section>

            {/* ── FAQ ── */}
            <section>
              <h2 className="text-sm font-semibold text-primary">
                Frequently Asked Questions
              </h2>
              <FAQAccordion items={faq} />
            </section>

          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
