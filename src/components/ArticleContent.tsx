import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import { slugifyHeading } from "@/lib/articleToc";

// Tekst z węzłów Reacta — do wyliczenia id kotwicy nagłówka (spójnie ze spisem treści).
function toText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(toText).join("");
  if (typeof node === "object" && "props" in node) {
    return toText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

// Premium, ciemny renderer treści artykułu. Zastępuje ręczne parsowanie linii —
// daje prawdziwe listy, pogrubienia, linki, tabele i calloty (blockquote).
// Świadomie renderujemy `#` z treści jako <h2>, żeby na stronie był tylko jeden
// <h1> (tytuł artykułu) — lepsze SEO.
const components: Components = {
  h1: ({ children }) => (
    <h2
      id={slugifyHeading(toText(children))}
      className="mt-12 mb-4 scroll-mt-28 text-[26px] font-semibold tracking-tight text-white md:text-[30px]"
    >
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2
      id={slugifyHeading(toText(children))}
      className="mt-12 mb-4 scroll-mt-28 text-[26px] font-semibold tracking-tight text-white md:text-[30px]"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      id={slugifyHeading(toText(children))}
      className="mt-8 mb-3 scroll-mt-28 text-[20px] font-semibold tracking-tight text-white md:text-[22px]"
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-5 text-[17px] leading-8 text-white/82 md:text-[18px]">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-6 list-disc space-y-2 pl-5 marker:text-[#7aa333]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-6 list-decimal space-y-2 pl-5 marker:text-white/40">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="pl-1 text-[17px] leading-8 text-white/82 md:text-[18px]">
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-white/90">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-7 rounded-2xl border border-l-4 border-[#7aa333]/20 border-l-[#7aa333] bg-[#7aa333]/[0.07] px-5 py-4 text-[17px] leading-8 text-white/85 [&>:first-child]:mt-0 [&>:last-child]:mb-0 [&_li]:text-white/85 [&_p]:mb-3 [&_ul]:mb-0">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => {
    const url = href || "#";
    const isInternal = url.startsWith("/") || url.startsWith("#");
    const cls =
      "font-medium text-[#9fd14b] underline decoration-[#7aa333]/40 underline-offset-4 transition hover:decoration-[#9fd14b]";

    if (isInternal) {
      return (
        <Link href={url} className={cls}>
          {children}
        </Link>
      );
    }

    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  },
  hr: () => <hr className="my-10 border-white/10" />,
  img: ({ src, alt }) => (
    <img
      src={typeof src === "string" ? src : ""}
      alt={alt || ""}
      loading="lazy"
      className="my-8 w-full rounded-2xl border border-white/10"
    />
  ),
  table: ({ children }) => (
    <div className="my-7 overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full border-collapse text-left text-[15px] text-white/80">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-white/[0.04] text-white">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-white/10 px-4 py-3 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-white/5 px-4 py-3">{children}</td>
  ),
  code: ({ children }) => (
    <code className="rounded bg-white/10 px-1.5 py-0.5 text-[15px] text-[#9fd14b]">
      {children}
    </code>
  ),
};

export default function ArticleContent({ content }: { content: string }) {
  return (
    <div className="article-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
