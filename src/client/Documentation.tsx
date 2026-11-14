import { CivicHeader } from "./CivicHeader";
import { Fragment, useEffect, useRef, useState } from 'react';
import { DESIGN_DOCUMENT } from './design-document';
import { PUBLIC_GUIDE } from './public-guide';
import './documentation.css';
import ThreeAppLoop from './ThreeAppLoop';
import { trackDocumentSections } from './scroll-motion';

/** Render the supplied document as text and semantic elements, never raw HTML. */
function Inline({ text }: { text: string }) {
  return <>{text.split(/(\[[^\]]+\]\((?:https?:\/\/|\/)[^\s)]+\))/g).map((part,i) => {
    const link = part.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)$/);
    return link ? <a key={i} href={link[2]} >{link[1]}</a> : <Fragment key={i}>{part.replace(/\\#/g,'#')}</Fragment>;
  })}</>;
}
const slug = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function DocumentBody({ text = DESIGN_DOCUMENT }: { text?: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return <>{blocks.map((block,index) => {
    const lines = block.split('\n');
    if (block.startsWith('# ')) return <h2 className="document-title" key={index}>{block.slice(2)}</h2>;
    if (block.startsWith('### ')) return <h4 key={index} id={slug(block.slice(4))}>{block.slice(4)}</h4>;
    if (block.startsWith('## ')) return <h3 key={index} id={slug(block.slice(3))}>{block.slice(3)}</h3>;
    if (block === '[embed: node/97649559-e448]') return <ThreeAppLoop key={index} />;
    if (block.startsWith('[embed: ')) return <aside className="document-embed" key={index}><strong>Diagram reference</strong><code>{block}</code><span>The pasted document includes this reference; its diagram was not included.</span></aside>;
    if (lines.every(line => line.startsWith('- '))) return <ul key={index}>{lines.map((line,i) => <li key={i}><Inline text={line.slice(2)} /></li>)}</ul>;
    if (lines[0]?.startsWith('|')) {
      const cells = lines.map(line => line.split('|').slice(1,-1).map(cell => cell.trim()));
      return <div className="document-table" key={index}><table><thead><tr>{cells[0]!.map((cell,i) => <th key={i}>{cell}</th>)}</tr></thead><tbody>{cells.slice(2).map((row,i) => <tr key={i}>{row.map((cell,j) => <td key={j}><Inline text={cell} /></td>)}</tr>)}</tbody></table></div>;
    }
    return <p key={index}><Inline text={block} /></p>;
  })}</>;
}
export default function Documentation() {
  const sections = PUBLIC_GUIDE.split('\n').filter(line => line.startsWith('## ')).map(line => line.slice(3));
  const article = useRef<HTMLElement>(null);
  const [active, setActive] = useState('');
  useEffect(() => article.current ? trackDocumentSections(article.current, setActive) : undefined, []);
  function download() {
    const url = URL.createObjectURL(new Blob([PUBLIC_GUIDE], {type:'text/markdown;charset=utf-8'}));
    const anchor = document.createElement('a'); anchor.href=url; anchor.download='civic-synthesis-guide.md'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  return <div className="civic-shell documentation-shell"><CivicHeader stage="How it works" /><div className="documentation-progress" aria-hidden="true"><div /></div><main id="main-content" tabIndex={-1} className="civic-main documentation-main"><section className="documentation-heading"><div><p className="map-eyebrow">Public guide · updated November 13, 2026</p><h1>How Civic Synthesis works</h1><p>Read, respond, or journal. Understand the limits before sharing.</p></div><button className="outline" onClick={download}>Download guide ↓</button></section><div className="documentation-layout"><aside className="panel documentation-toc"><h2>In this guide</h2><nav aria-label="Guide sections">{sections.map(section => <a key={section} href={`#${slug(section)}`} aria-current={active === slug(section) ? "location" : undefined}>{section}</a>)}<a href="#historical-appendix">Historical appendix</a></nav></aside><article ref={article} className="panel documentation-article"><DocumentBody text={PUBLIC_GUIDE} /><details id="historical-appendix"><summary>Historical appendix — archived design report, November 12, 2026</summary><div className="documentation-note">Historical internal planning, preserved for context. Dates, countdowns, operational claims and recommendations below are archived, not current instructions or commitments. Other apps' plans do not define Civic Synthesis requirements.</div><DocumentBody /></details></article></div></main></div>;
}
