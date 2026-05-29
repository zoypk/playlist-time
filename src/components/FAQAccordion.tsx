import React from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./ui/accordion";

interface FAQItem {
  q: string;
  a: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
}

export function FAQAccordion({ items }: FAQAccordionProps) {
  return (
    <Accordion type="single" collapsible className="mt-3 space-y-2">
      {items.map((item, index) => (
        <AccordionItem key={`faq-${index}`} value={item.q} className="bg-surface-darker/60">
          <AccordionTrigger className="text-sm font-medium text-gray-100 px-3 py-2">
            <h3 className="text-left">{item.q}</h3>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-gray-400 px-3 py-2">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}

      <AccordionItem key="views-column" value="views-column" className="bg-surface-darker/60">
        <AccordionTrigger className="text-sm font-medium text-gray-100 px-3 py-2">
          <h3 className="text-left">What does the Views column represent?</h3>
        </AccordionTrigger>
        <AccordionContent className="text-sm text-gray-400 px-3 py-2">
          Views are shown as extra context. If available, the number is derived from video-level view counts and summed across the playlist.
          Watch time is always calculated from video durations, not from views.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
