import type { ReactElement } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./ui/accordion";
import { FAQAccordion } from "./FAQAccordion";

/** Ordered instruction shown in the calculation guide. */
export interface Step {
  title: string;
  detail: string;
}

/** Short title/detail pair used for feature and comparison lists. */
export interface Feature {
  title: string;
  detail: string;
}

/** SEO/supporting-content data rendered below the primary analyzer. */
export interface ContentAccordionProps {
  faq: Array<{ q: string; a: string }>;
  howItWorks: Step[];
  features: Feature[];
  comparison?: Feature[];
  whyUse: string;
}

export function ContentAccordion({ faq, howItWorks, features, comparison = [], whyUse }: ContentAccordionProps): ReactElement {
  const quickChecks = [
    { label: "Speed math", value: "1x-3x" },
    { label: "Playlist range", value: "Start-End" },
    { label: "Output", value: "Copy + CSV" },
  ];

  return (
    <Accordion type="single" collapsible defaultValue="how-it-works">
      <AccordionItem value="how-it-works" className="border-none">
        <AccordionTrigger className="rounded-t-lg bg-background-dark/70 px-5 py-4 text-left">
          <span>
            <span className="block text-sm font-semibold text-gray-100">Planner notes</span>
            <span className="mt-1 block text-xs font-medium text-warm-muted">
              Duration math, range rules, exports, and the common edge cases.
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="border-t border-border-dark bg-background-dark/35">
          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
            <section className="space-y-5">
              <div>
                <p className="font-mono text-xs font-semibold uppercase text-accent">Quick reference</p>
                <h2 className="mt-2 text-xl font-bold leading-tight text-white">Measure the real watch-time before you start.</h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-300">
                  playlist-time is a free <strong>YouTube Playlist Length Calculator</strong> for checking total playlist duration, playback-speed math, selected video ranges, and daily watch plans.
                </p>
              </div>

              <dl className="grid grid-cols-3 gap-2">
                {quickChecks.map((check) => (
                  <div key={check.label} className="rounded-md border border-border-dark bg-surface-darker/60 px-3 py-3 shadow-inset">
                    <dt className="text-[11px] font-medium text-warm-muted">{check.label}</dt>
                    <dd className="mt-1 font-mono text-xs font-bold text-white">{check.value}</dd>
                  </div>
                ))}
              </dl>

              <p className="rounded-md border border-border-dark bg-accent-soft/35 p-4 text-sm leading-relaxed text-gray-200">
                {whyUse}
              </p>
            </section>

            <div className="space-y-6">
              <section>
                <h2 className="text-sm font-semibold text-primary">How the calculation works</h2>
                <ol className="mt-4 grid gap-2 text-sm text-gray-300 sm:grid-cols-2">
                  {howItWorks.map((step, i) => (
                    <li key={i} className="rounded-md border border-border-dark bg-background-dark/45 p-3">
                      <span className="font-mono text-xs font-bold text-accent">{String(i + 1).padStart(2, "0")}</span>
                      <span className="mt-2 block font-medium text-gray-100">{step.title}</span>
                      <span className="mt-1 block leading-relaxed text-warm-muted">{step.detail}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs text-warm-muted">
                  Note: totals can change if videos become unavailable or if a playlist is updated after analysis.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-primary">Planning tools included</h2>
                <ul className="mt-4 grid gap-2 text-sm text-gray-300 sm:grid-cols-2">
                  {features.map((feat, i) => (
                    <li key={i} className="rounded-md bg-surface-darker/40 px-3 py-2">
                      <span className="font-medium text-gray-100">{feat.title}</span>
                      <span className="block text-warm-muted">{feat.detail}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {comparison.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-primary">Where it helps most</h2>
                  <ul className="mt-4 grid gap-2 text-sm text-gray-300 sm:grid-cols-2">
                    {comparison.map((item, i) => (
                      <li key={i} className="rounded-md border border-border-dark/75 bg-background-dark/35 px-3 py-2">
                        <span className="font-medium text-gray-100">{item.title}</span>
                        <span className="block text-warm-muted">{item.detail}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h2 className="text-sm font-semibold text-primary">Common playlist time questions</h2>
                <FAQAccordion items={faq} />
              </section>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
