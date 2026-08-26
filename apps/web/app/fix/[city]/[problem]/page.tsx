import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allFixPages, getFixPage } from "@/lib/seo/content";
import "../../../landing.css";

// Static at build time from committed JSON: no API call per visit, and a
// crawler hitting 300 pages costs nothing.
export function generateStaticParams() {
  return allFixPages().map((p) => ({ city: p.city, problem: p.problem }));
}

export async function generateMetadata(
  { params }: { params: { city: string; problem: string } },
): Promise<Metadata> {
  const page = getFixPage(params.city, params.problem);
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/fix/${page.city}/${page.problem}` },
    openGraph: { title: page.metaTitle, description: page.metaDescription },
  };
}

export default function FixPage({ params }: { params: { city: string; problem: string } }) {
  const page = getFixPage(params.city, params.problem);
  if (!page) notFound();

  // FAQ structured data — this is the markup that wins the expandable
  // questions under a search result, and it is the whole point of the FAQ list.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((f) => ({
      "@type": "Question", name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="tareaLanding">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <header className="siteHeader shell">
        <Link className="brand" href="/">
          <img className="brandLogo" src="/tarea-logo.svg" alt="" aria-hidden="true" />
          Tarea
        </Link>
        <div className="headerActions">
          <Link className="loginLink" href="/login">Log in</Link>
          <Link className="button buttonSmall buttonCoral" href="/diagnose">Diagnose my issue</Link>
        </div>
      </header>

      <article className="shell" style={{ maxWidth: 760, paddingBottom: 64 }}>
        <p className="eyebrow" style={{ marginTop: 24 }}>{page.categoryLabel.toUpperCase()} · {page.cityName.toUpperCase()}</p>
        <h1 style={{ fontSize: "clamp(32px, 4vw, 46px)", lineHeight: 1.05, letterSpacing: "-.04em", margin: "0 0 16px" }}>
          {page.problemTitle} in {page.cityName}
        </h1>
        <p className="heroLead">{page.intro}</p>

        <div className="promiseCard" style={{ margin: "24px 0" }}>
          <strong style={{ fontSize: 26 }}>${page.price.low}–${page.price.high}</strong>
          <p style={{ margin: "6px 0 0", color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6 }}>{page.priceNote}</p>
        </div>

        <h2>Common causes</h2>
        <ul>{page.causes.map((c, i) => <li key={i}>{c}</li>)}</ul>

        <h2>What a pro does</h2>
        <ol>{page.whatProDoes.map((s, i) => <li key={i}>{s}</li>)}</ol>

        <h2>Do it yourself, or call a pro?</h2>
        <p>{page.diyOrPro}</p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "28px 0" }}>
          <Link className="button buttonCoral" href="/diagnose">Diagnose my issue</Link>
          <Link className="button buttonLight" href="/browse">Browse pros near me</Link>
        </div>

        <h2>Questions</h2>
        {page.faqs.map((f, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{f.q}</h3>
            <p style={{ margin: 0, color: "var(--ink-soft)", lineHeight: 1.7 }}>{f.a}</p>
          </div>
        ))}

        <p style={{ marginTop: 32, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          Prices are estimates for {page.cityName} and depend on what the job turns out to involve.
          Tarea sets the labor price before you hire, so you know it up front.
        </p>
      </article>
    </main>
  );
}
