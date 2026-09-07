"use client";

import { useEffect, useState } from "react";

/**
 * The rotating example diagnosis on the landing page.
 *
 * Every figure here is an INTERVAL whose ends are TOTALS with the 27.78% service
 * fee already inside them, because that is what the product actually quotes
 * (api/ai/price-estimate returns `priceRange`, "both ends are TOTALS with the fee
 * already in them (SB 478)"). The previous card advertised a single "FIXED LABOR
 * $142", which was wrong twice over: the price is not fixed before a Pro is
 * chosen -- it derives from that Pro's own hourly rate (lib/labor-pricing.ts
 * resolveRate) -- and quoting the labour component as the headline understates
 * what a customer pays, which is the thing SB 478 exists to stop.
 *
 * Rates below are illustrative spreads of what different Pros charge, not rates
 * Tarea sets or recommends. Tarea must never set, floor, or benchmark Pro rates.
 */
interface Example {
  img: string;
  alt: string;
  issue: string;
  meta: string;
  low: number;
  high: number;
}

const EXAMPLES: Example[] = [
  {
    img: "/broken-faucet-cartridge.png",
    alt: "A worn kitchen faucet cartridge being inspected beside a faucet",
    issue: "Kitchen faucet cartridge leak",
    meta: "Plumbing · Standard complexity · About 1.5 hours",
    low: 125, high: 163,
  },
  {
    img: "/diagnosis-outlet.png",
    alt: "A scorched electrical outlet being examined",
    issue: "Scorched outlet needs replacing",
    meta: "Electrical · Standard complexity · About 1 hour",
    low: 89, high: 121,
  },
  {
    img: "/diagnosis-hvac.png",
    alt: "A clogged HVAC filter being removed from a return vent",
    issue: "Blocked return vent and clogged filter",
    meta: "HVAC · Simple · About 1 hour",
    low: 96, high: 128,
  },
  {
    img: "/diagnosis-drywall.png",
    alt: "A hole in drywall beside patching tools",
    issue: "Drywall hole needs patch and paint",
    meta: "Carpentry · Standard complexity · About 2 hours",
    low: 153, high: 204,
  },
  {
    img: "/diagnosis-door.png",
    alt: "A door that no longer closes flush against its frame",
    issue: "Door out of alignment, will not latch",
    meta: "General repair · Simple · About 1 hour",
    low: 77, high: 102,
  },
];

const ROTATE_MS = 10_000;
const FADE_MS = 320;

export default function DiagnosisDemo() {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Someone who has asked for less motion should not get a carousel that
    // changes under them; they still see the first example, fully readable.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const id = setInterval(() => {
      setVisible(false);
      // Swap while faded out, so the photo and its price never disagree mid-fade.
      setTimeout(() => {
        setI((n) => (n + 1) % EXAMPLES.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  const ex = EXAMPLES[i];
  const fade = { opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` };

  return (
    <div className="quoteDemo" aria-label="Example Tarea diagnosis" aria-live="polite">
      <div className="issuePhoto">
        <img
          src={ex.img}
          alt={ex.alt}
          style={fade}
          // A missing example photo must not leave a broken icon in the hero.
          onError={(e) => { e.currentTarget.src = EXAMPLES[0].img; }}
        />
        <span className="photoTag">Photo added</span>
      </div>
      <div className="quotePanel" style={fade}>
        <div className="quoteTop"><span>✦ DIAGNOSIS READY</span><span>HIGH CONFIDENCE</span></div>
        <small>LIKELY ISSUE</small>
        <h3>{ex.issue}</h3>
        <p>{ex.meta}</p>
        <div className="quoteTotal">
          <div>
            <small>ESTIMATED TOTAL</small>
            <strong>${ex.low} – ${ex.high}</strong>
          </div>
          <span>Service fee included · Materials separate</span>
        </div>
      </div>
      <div className="demoDots" role="tablist" aria-label="Choose an example">
        {EXAMPLES.map((e, n) => (
          <button
            key={e.img}
            type="button"
            role="tab"
            aria-selected={n === i}
            aria-label={e.issue}
            className={n === i ? "demoDot demoDotOn" : "demoDot"}
            onClick={() => { setI(n); setVisible(true); }}
          />
        ))}
      </div>
    </div>
  );
}
