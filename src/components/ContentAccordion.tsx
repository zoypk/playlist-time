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
  comparison?: Feature[];
  whyUse: string;
}

export function ContentAccordion({ faq, howItWorks, features, comparison = [], whyUse }: ContentAccordionProps) {
  return (
    <Accordion type="single" collapsible defaultValue="how-it-works">
      <AccordionItem value="how-it-works" className="border-none">
        <AccordionTrigger className="rounded-t-lg bg-background-dark/70 px-5 py-4 text-sm font-semibold">
          Calculation guide and FAQ
        </AccordionTrigger>
        <AccordionContent className="border-t border-border-dark bg-background-dark/35">
          <div className="grid gap-8 p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="max-w-prose">
              <h2 className="text-sm font-semibold text-primary">What is yttime?</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">
                yttime is a free <strong>YouTube Playlist Length Calculator</strong> that tells you exactly how long any playlist takes to watch. Whether you need to plan study sessions around a lecture series, schedule time for an online course, or simply find out how long a music compilation runs, this tool gives you an instant answer. Enter one or more playlist links and get the <strong>total YouTube playlist time</strong> broken down by playback speed: 1x, 1.25x, 1.5x, 1.75x, or any custom rate you prefer.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                Unlike manually scrolling through every video to add up durations, this <strong>YouTube playlist length calculator</strong> does the math for you in seconds. It also handles partial playlists: set a start and end range to calculate the duration of only the videos you actually plan to watch.
              </p>
            </section>

            <div className="space-y-8">
              <section>
                <h2 className="text-sm font-semibold text-primary">How to calculate YouTube playlist duration</h2>
                <p className="mt-3 text-sm text-gray-300">
                  Use this <strong>online playlist calculator</strong> to convert playlist length into real watch-time estimates in just a few steps:
                </p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-300">
                  {howItWorks.map((step, i) => (
                    <li key={i}>
                      <span className="font-medium text-gray-100">{step.title}</span>: {step.detail}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs text-warm-muted">
                  Note: totals can change if videos become unavailable or if a playlist is updated after analysis.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-primary">Features and planning tools</h2>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-gray-300">
                  {features.map((feat, i) => (
                    <li key={i}>
                      <span className="font-medium text-gray-100">{feat.title}</span>: {feat.detail}
                    </li>
                  ))}
                </ul>
              </section>

              {comparison.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-primary">What makes this YouTube playlist calculator different?</h2>
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-gray-300">
                    {comparison.map((item, i) => (
                      <li key={i}>
                        <span className="font-medium text-gray-100">{item.title}</span>: {item.detail}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h2 className="text-sm font-semibold text-primary">Why use this playlist watch time calculator?</h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-300">{whyUse}</p>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-primary">Frequently asked questions</h2>
                <FAQAccordion items={faq} />
              </section>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
