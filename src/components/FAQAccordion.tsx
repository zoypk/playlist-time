import type { ReactElement } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./ui/accordion";

/** Single question/answer pair rendered in the FAQ accordion. */
export interface FAQItem {
  q: string;
  a: string;
}

/** Props for the compact FAQ accordion. */
export interface FAQAccordionProps {
  items: FAQItem[];
}

export function FAQAccordion({ items }: FAQAccordionProps): ReactElement {
  return (
    <Accordion type="single" collapsible className="mt-3 space-y-2">
      {items.map((item, index) => (
        <AccordionItem key={`faq-${index}`} value={item.q} className="bg-background-dark/55">
          <AccordionTrigger className="px-3 py-2 text-sm font-medium text-gray-100">
            <h3 className="text-left">{item.q}</h3>
          </AccordionTrigger>
          <AccordionContent className="px-3 py-2 text-sm text-warm-muted">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}

    </Accordion>
  );
}
