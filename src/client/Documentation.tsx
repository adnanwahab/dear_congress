import { CivicHeader } from "./CivicHeader";
import { Fragment, useEffect, useRef, useState } from 'react';
import { DESIGN_DOCUMENT } from './design-document';
import './documentation.css';
import ThreeAppLoop from './ThreeAppLoop';
import { trackDocumentSections } from './scroll-motion';

/** Render the supplied document as text and semantic elements, never raw HTML. */
function Inline({ text }: { text: string }) {
  return <>{text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part,i) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    return link ? <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a> : <Fragment key={i}>{part.replace(/\\#/g,'#')}</Fragment>;
  })}</>;
}
const slug = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function DocumentBody() {
  const blocks = DESIGN_DOCUMENT.trim().split(/\n\s*\n/);
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
  const sections = DESIGN_DOCUMENT.split('\n').filter(line => line.startsWith('## ')).map(line => line.slice(3));
  const article = useRef<HTMLElement>(null);
  const [active, setActive] = useState('');
  useEffect(() => article.current ? trackDocumentSections(article.current, setActive) : undefined, []);
  function download() {
    const url = URL.createObjectURL(new Blob([DESIGN_DOCUMENT], {type:'text/markdown;charset=utf-8'}));
    const anchor = document.createElement('a'); anchor.href=url; anchor.download='civic-synthesis-design-document.md'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  return <div className="civic-shell documentation-shell"><CivicHeader stage="Design & direction" /><div className="documentation-progress" aria-hidden="true"><div /></div><main className="civic-main documentation-main"><section className="documentation-heading"><div><p className="map-eyebrow">The thinking behind the work</p><h1>DOCUMENTATION</h1><p>One loop across three apps: ideas, decisions, and checks.</p></div><button className="outline" onClick={download}>Download document ↓</button></section><div className="documentation-layout"><aside className="panel documentation-toc"><h2>In this document</h2><nav aria-label="Document sections">{sections.map(section => <a key={section} href={`#${slug(section)}`} aria-current={active === slug(section) ? "location" : undefined}>{section}</a>)}</nav><a className="documentation-api-link" href="/journal?tab=api">Journal API documentation ↗</a></aside><article ref={article} className="panel documentation-article"><div className="documentation-note">The supplied design document is reproduced below, with its tables restored for readability. Status statements and recommendations reflect the document’s November 12 snapshot.</div><DocumentBody /></article></div></main></div>;
}
