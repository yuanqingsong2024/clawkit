import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode, useState } from 'react';

type AccordionType = 'single' | 'multiple';

interface AccordionItemData {
  id: string;
  title: string;
  content: ReactNode;
  defaultOpen?: boolean;
}

interface AccordionProps {
  items: AccordionItemData[];
  type?: AccordionType;
  className?: string;
}

interface AccordionItemProps {
  item: AccordionItemData;
  isOpen: boolean;
  onToggle: () => void;
}

function AccordionItem({ item, isOpen, onToggle }: AccordionItemProps): JSX.Element {
  const contentId = `accordion-content-${item.id}`;
  const triggerId = `accordion-trigger-${item.id}`;

  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        id={triggerId}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-0"
      >
        <span>{item.title}</span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="h-5 w-5 shrink-0 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            id={contentId}
            role="region"
            aria-labelledby={triggerId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 text-sm text-slate-700">{item.content}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function Accordion({ items, type = 'multiple', className = '' }: AccordionProps): JSX.Element {
  const defaultOpenIds = items.filter((item) => item.defaultOpen).map((item) => item.id);
  const [openIds, setOpenIds] = useState<string[]>(defaultOpenIds);

  const handleToggle = (itemId: string) => {
    if (type === 'single') {
      setOpenIds((prev) => (prev.includes(itemId) ? [] : [itemId]));
    } else {
      setOpenIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
    }
  };

  return (
    <div className={`divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}>
      {items.map((item) => (
        <AccordionItem key={item.id} item={item} isOpen={openIds.includes(item.id)} onToggle={() => handleToggle(item.id)} />
      ))}
    </div>
  );
}
