import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

// Nothing-styled markdown: simple, readable prose. Used for the optimized
// (presentation-ready) text, which the agent emits as standard markdown.
const components: Components = {
  p: (props) => (
    <p className="text-primary text-body leading-[1.65] mb-3 last:mb-0" {...props} />
  ),
  ul: (props) => <ul className="space-y-1.5 mb-3 last:mb-0" {...props} />,
  ol: (props) => <ol className="space-y-1.5 mb-3 last:mb-0 list-decimal pl-5" {...props} />,
  li: (props) => (
    <li className="text-primary text-body leading-snug flex gap-2 marker:text-accent">
      <span className="text-accent shrink-0">—</span>
      <span {...props} />
    </li>
  ),
  strong: (props) => <strong className="font-medium text-display" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  a: (props) => <a className="text-interactive underline hover:opacity-80" {...props} />,
  code: (props) => (
    <code className="font-mono text-label text-secondary" {...props} />
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-0">
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
}
