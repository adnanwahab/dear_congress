import { useRef } from "react";

/** Explanatory UI only: never transforms citizen text or supplies legal sources. */
export function ProposalReadingHelp() {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  return <details className="cp-reading-help" ref={disclosure} onKeyDown={event => {
    if (event.key === "Escape" && disclosure.current?.open) {
      event.preventDefault();
      event.stopPropagation();
      disclosure.current.open = false;
      trigger.current?.focus();
    }
  }}>
    <summary ref={trigger}>Help with civic terms</summary>
    <p>These explanations describe this site. They do not change the proposal or replace its original text.</p>
    <dl>
      <dt>Citizen proposal</dt>
      <dd>An idea written by a participant. A public page here does not mean a government has approved it. <a href="#cp-source-status">Read the original source-status notice</a>.</dd>
      <dt>Advisory response</dt>
      <dd>Your choice helps people discuss the idea. It does not make the idea law or cast a vote in a government election. <a href="#cp-advisory-process">Read what happens next</a>.</dd>
      <dt>Browser identity</dt>
      <dd>This site uses a browser cookie to remember a response. A browser response does not prove where someone lives or their citizenship. <a href="#cp-browser-identity">Read the original counting limits</a>.</dd>
    </dl>
  </details>;
}
