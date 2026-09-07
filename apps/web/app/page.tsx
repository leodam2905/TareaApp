import Link from "next/link";
import DiagnosisDemo from "@/components/DiagnosisDemo";

// Landing page ported from the Sites export (tarea-claude-export-v1-2).
//
// The export was a standalone artifact: hand-written CSS classes rather than
// Tailwind utilities, and every link a dead "#" anchor. The styles live in
// landing.css, scoped under .tareaLanding so its generic names (.button,
// .hero, .shell) cannot leak into the dashboard pages, and the CTAs that used
// to go nowhere now point at /register and /login — the funnel the previous
// page carried and this one had no way to.
import "./landing.css";

const Arrow = () => <span aria-hidden="true">↗</span>;

const services = [
  { icon: "plumbing", title: "Plumbing", copy: "Leaks, faucets, toilets & fixtures" },
  { icon: "electrical", title: "Electrical", copy: "Lights, switches, fans & outlets" },
  { icon: "assembly", title: "Assembly", copy: "Furniture, shelving & setup" },
  { icon: "painting", title: "Painting", copy: "Walls, trim & touch-ups" },
  { icon: "doors", title: "Doors & hardware", copy: "Locks, hinges, handles & doors" },
  { icon: "mounting", title: "TV & wall mounting", copy: "TVs, mirrors, art & shelving" },
  { icon: "appliance", title: "Appliance help", copy: "Installation & minor appliance fixes" },
  { icon: "carpentry", title: "Carpentry", copy: "Trim, cabinets & small wood repairs" },
  { icon: "drywall", title: "Drywall repair", copy: "Holes, cracks, patches & finishing" },
  { icon: "smart", title: "Smart home setup", copy: "Cameras, locks, hubs & doorbells" },
  { icon: "outdoor", title: "Outdoor repairs", copy: "Fences, gates & exterior fixes" },
  { icon: "general", title: "General handyman", copy: "Small repairs around your home" },
];

const iconPaths: Record<string, string> = {
  plumbing: "M14.7 6.3a4 4 0 0 0-5-5l2.1 2.1-2.4 2.4-2.1-2.1a4 4 0 0 0 5 5L3 18a2.1 2.1 0 1 0 3 3l9.3-9.3a4 4 0 0 0 5-5l-2.1 2.1-2.4-2.4 2.1-2.1-2.2-2Z",
  electrical: "m13 2-8 12h7l-1 8 8-12h-7l1-8Z",
  assembly: "m4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7M12 11v10",
  painting: "m14 4 6 6-8.5 8.5a2.1 2.1 0 0 1-3 0l-3-3a2.1 2.1 0 0 1 0-3L14 4Zm-5 12-5 5M15.5 8.5l-7 7",
  doors: "M5 3h13v18H5V3Zm4 2v16m6-9h.01",
  mounting: "M3 5h18v12H3V5Zm5 16h8m-4-4v4",
  appliance: "M6 2h12a2 2 0 0 1 2 2v16H4V4a2 2 0 0 1 2-2Zm-2 5h16M8 4h.01M11 4h.01M8 14a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z",
  carpentry: "m14 5 5 5-3 3-5-5M4 20l8-8m-5-5 3-3 10 10-3 3L7 7Z",
  drywall: "M3 4h18v16H3V4Zm6 0v16m6-16v16M3 12h6m6 0h6",
  smart: "M4 11.5 12 4l8 7.5M6.5 10v10h11V10M9 15a4.2 4.2 0 0 1 6 0m-4 3a1.4 1.4 0 0 1 2 0",
  outdoor: "M12 21v-8m0 0c-5 0-7-3.5-7-7 4.5 0 7 2 7 7Zm0 2c5 0 7-3.5 7-7-4.5 0-7 2-7 7Z",
  general: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 7h18v13H3V7Zm0 5h18m-11 0v2h4v-2",
};

function ServiceIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={iconPaths[name]} />
    </svg>
  );
}

const proBenefitPaths: Record<string, string> = {
  payouts: "M4 17 10 11l4 4 6-8M14 7h6v6",
  flow: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  control: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  reputation: "m12 2 3.1 6.28L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.9-.99L12 2Z",
};

function ProBenefitIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={proBenefitPaths[name]} />
    </svg>
  );
}

function Logo() {
  return (
    <a className="brand" href="#top" aria-label="Tarea home">
      <img className="brandLogo" src="/tarea-logo.svg" alt="" aria-hidden="true" />
      <span>Tarea</span>
    </a>
  );
}

export default function Home() {
  return (
    // Every landing style is scoped under this class — see landing.css.
    <main id="top" className="tareaLanding">
      <header className="siteHeader shell">
        <Logo />
        <nav className="desktopNav" aria-label="Main navigation">
          <a href="#services">Services</a>
          <a href="#diagnosis">AI diagnosis</a>
          <a href="#choice">Choose a Pro</a>
          <a href="#pros">For Pros</a>
        </nav>
        <div className="headerActions">
          <Link className="loginLink" href="/login">Log in</Link>
          <Link className="button buttonSmall buttonCoral" href="/register">Get started</Link>
        </div>
        <details className="mobileMenu">
          <summary aria-label="Open menu"><span /><span /><span /></summary>
          <nav aria-label="Mobile navigation">
            <a href="#services">Services</a>
            <a href="#diagnosis">AI diagnosis</a>
            <a href="#choice">Choose a Pro</a>
            <a href="#pros">For Pros</a>
            <Link href="/login">Log in</Link>
          </nav>
        </details>
      </header>

      <section className="hero shell" aria-labelledby="hero-title">
        <div className="heroCopy">
          <p className="eyebrow"><span>✦</span> HOME REPAIRS MADE SIMPLE</p>
          <h1 id="hero-title">
            <span>Show the issue.</span>
            <span className="coralText">Choose your Pro.</span>
            <span className="tealText">Get it done.</span>
          </h1>
          <p className="heroLead">Tarea identifies the work, sets a fixed labor price, and introduces qualified local Pros. Compare profiles and choose who comes to your home.</p>
          <div className="heroActions">
            <Link className="button buttonCoral" href="/diagnose">Diagnose my issue <Arrow /></Link>
            <Link className="button buttonLight" href="/browse">Browse Pros</Link>
          </div>
          <ul className="heroProof" aria-label="Tarea benefits">
            <li><span>✓</span> Start before signup</li>
            <li><span>✓</span> Fixed labor price</li>
            <li><span>✓</span> You choose</li>
          </ul>
        </div>

        <div className="heroVisual" aria-label="Homeowner and local repair professional">
          <div className="heroShape heroShapeOne" />
          <div className="heroShape heroShapeTwo" />
          <div className="imageFrame">
            {/* Muted + playsInline are not stylistic: browsers refuse to
                autoplay anything with sound, and without playsInline iOS
                Safari takes the video fullscreen the moment it starts.
                The poster shows instantly and is what remains if the video
                cannot play at all. */}
            <video
              src="/tarea-hero.mp4"
              poster="/tarea-hero-poster.jpg"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="A local repair professional at work"
            />
          </div>
          <div className="floatCard diagnosisCard">
            <span className="floatIcon">✦</span>
            <div><small>AI DIAGNOSIS READY</small><strong>Likely issue identified</strong></div>
          </div>
          <div className="floatCard priceCard">
            <span className="checkBadge">✓</span>
            <div><small>YOUR QUOTE</small><strong>Fixed labor price</strong></div>
          </div>
        </div>
      </section>

      <section className="promiseBand" aria-label="Tarea promise">
        <div className="shell promiseInner">
          <article className="promiseCard">
            <span className="promiseIcon" aria-hidden="true">⌕</span>
            <div><strong>Start with the issue,<br />not the trade.</strong><small>Describe what needs fixing. Tarea helps identify the right service.</small></div>
          </article>
          <article className="promiseCard featuredPromise">
            <span className="promiseIcon" aria-hidden="true">$</span>
            <div><strong>Know the price<br />before you book.</strong><small>See a fixed labor price and estimated minimum time upfront.</small></div>
          </article>
          <article className="promiseCard">
            <span className="promiseIcon" aria-hidden="true">✓</span>
            <div><strong>You decide who<br />gets the job.</strong><small>Compare eligible Pro profiles and choose the best fit yourself.</small></div>
          </article>
        </div>
      </section>

      <section className="section shell servicesSection" id="services" aria-labelledby="services-title">
        <div className="sectionIntro">
          <div>
            <p className="sectionKicker">SERVICES</p>
            <h2 id="services-title">Tell us what needs fixing.</h2>
          </div>
          <p>Not sure what service you need? Describe the issue and Tarea helps identify the right kind of Pro.</p>
        </div>
        <div className="serviceGrid">
          {services.map((service) => (
            <a className="serviceCard" href="#diagnosis" key={service.title}>
              <span className="serviceIcon"><ServiceIcon name={service.icon} /></span>
              <span><strong>{service.title}</strong><small>{service.copy}</small></span>
              <span className="serviceArrow" aria-hidden="true">→</span>
            </a>
          ))}
        </div>
      </section>

      <section className="diagnosisSection" id="diagnosis" aria-labelledby="diagnosis-title">
        <div className="shell diagnosisLayout">
          <div className="diagnosisCopy">
            <p className="sectionKicker coralKicker">AI DIAGNOSIS + INSTANT QUOTE</p>
            <h2 id="diagnosis-title">Show Tarea what&apos;s wrong.</h2>
            <p>Add a description and photos. Tarea identifies the likely issue, estimates the billable time, and shows the price range built from Pros&apos; own hourly rates — service fee included, materials quoted separately by the Pro.</p>
            <ul className="featurePills" aria-label="Diagnosis features">
              <li>Photo-assisted diagnosis</li>
              <li>Price range up front</li>
              <li>Materials separate</li>
            </ul>
            <Link className="button buttonCoral" href="/diagnose">Start a diagnosis <Arrow /></Link>
          </div>

          <DiagnosisDemo />
        </div>
      </section>

      <section className="section shell choiceSection" id="choice" aria-labelledby="choice-title">
        <div className="choiceCopy">
          <p className="sectionKicker">YOUR CHOICE</p>
          <h2 id="choice-title">Meet eligible Pros.<br />You choose who gets the job.</h2>
          <p>Pros are matched by service category, service area, and availability. Compare their experience, ratings, credentials, and schedule—then make the decision yourself.</p>
          <div className="choiceChecks">
            <span><i>✓</i> Verified profiles</span>
            <span><i>✓</i> Insurance &amp; license indicators</span>
            <span><i>✓</i> Availability before booking</span>
          </div>
        </div>

        <div className="proStack" aria-label="Example matched Pros">
          <article className="proCard proCardSelected">
            <div className="proAvatar avatarOne">JD</div>
            <div className="proInfo"><strong>Jordan D.</strong><small>Plumbing · 6 years experience</small><span>★ 4.9 <em>128 reviews</em></span><div><b>Verified</b><b>Insured</b><b>Today</b></div></div>
            <button type="button">Choose Jordan</button>
          </article>
          <article className="proCard">
            <div className="proAvatar avatarTwo">AM</div>
            <div className="proInfo"><strong>Alex M.</strong><small>Handyman · 8 years experience</small><span>★ 4.8 <em>96 reviews</em></span><div><b>Verified</b><b>Top rated</b><b>Tomorrow</b></div></div>
            <button type="button">View profile</button>
          </article>
          <article className="proCard">
            <div className="proAvatar avatarThree">SR</div>
            <div className="proInfo"><strong>Sam R.</strong><small>Plumbing · 10 years experience</small><span>★ 4.9 <em>214 reviews</em></span><div><b>Verified</b><b>Licensed</b><b>2 days</b></div></div>
            <button type="button">View profile</button>
          </article>
        </div>
      </section>

      <section className="zenSection shell" id="zentarea" aria-labelledby="zentarea-title">
        <div className="zenCard">
          <div className="zenMark" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
              <path d="m8.5 12 2.25 2.25L16 9" />
            </svg>
          </div>
          <div className="zenCopy">
            <p className="sectionKicker">PROTECTION AFTER THE JOB</p>
            <h2 id="zentarea-title"><span>Zen</span>Tarea capped guarantee.</h2>
            <p>If eligible completed work does not meet Tarea standards, our support team reviews the issue and may provide a covered remedy up to the applicable guarantee cap.</p>
          </div>
          <div className="zenBenefits" aria-label="ZenTarea guarantee features">
            <span><i>✓</i><strong>Eligible jobs protected</strong><small>Coverage for qualifying completed work</small></span>
            <span><i>✓</i><strong>Support-led review</strong><small>A clear path to report an issue</small></span>
            <span><i>✓</i><strong>Dispute support</strong><small>Report concerns from the job record for review</small></span>
            <span><i>✓</i><strong>Defined coverage cap</strong><small>Limits and exclusions are stated in the terms</small></span>
            <span><i>✓</i><strong>Payments processed by Stripe</strong><small>Tarea never receives or stores your card number</small></span>
          </div>
          <p className="zenTerms">Eligibility requirements, coverage limits, exclusions, and claim deadlines apply.</p>
        </div>
      </section>

      <section className="prosSection" id="pros" aria-labelledby="pros-title">
        <div className="shell prosCard">
          <div className="prosCopy">
            <p className="sectionKicker coralKicker">FOR SKILLED PROS</p>
            <h2 id="pros-title">Local work. Clear pricing. A reputation that grows.</h2>
            <p>Receive relevant local opportunities based on your categories, service area, and availability. Tarea sets the labor price. Customers choose the Pro.</p>
            <Link className="button buttonCoral" href="/register?role=handyman">Become a Tarea Pro <Arrow /></Link>
          </div>
          <div className="proBenefits" aria-label="Benefits for Tarea Pros">
            <article className="proBenefitCard">
              <span className="proBenefitIcon"><ProBenefitIcon name="payouts" /></span>
              <div><h3>Fast payouts</h3><p>Cash out as soon as the customer&apos;s payment clears — usually about two business days.</p></div>
            </article>
            <article className="proBenefitCard">
              <span className="proBenefitIcon"><ProBenefitIcon name="flow" /></span>
              <div><h3>Steady job flow</h3><p>Receive relevant opportunities from customers in your area.</p></div>
            </article>
            <article className="proBenefitCard">
              <span className="proBenefitIcon"><ProBenefitIcon name="control" /></span>
              <div><h3>You&apos;re in control</h3><p>Choose the jobs, hours, and service radius that work for you.</p></div>
            </article>
            <article className="proBenefitCard">
              <span className="proBenefitIcon"><ProBenefitIcon name="reputation" /></span>
              <div><h3>Build your reputation</h3><p>Grow your ratings and stand out to more local customers.</p></div>
            </article>
          </div>
        </div>
      </section>

      <section className="finalCta shell" aria-labelledby="final-cta-title">
        <p className="sectionKicker">YOUR NEXT REPAIR STARTS HERE</p>
        <h2 id="final-cta-title">A clearer way to get home repairs done.</h2>
        <p>Describe the issue, know the labor price, and choose the right Pro for your home.</p>
        <div>
          <Link className="button buttonCoral" href="/diagnose">Diagnose my issue <Arrow /></Link>
          <Link className="button buttonLight" href="/browse">Browse Pros</Link>
        </div>
      </section>

      <section id="download" className="appDownload" aria-labelledby="app-title">
        <div className="shell appDownloadInner">
          <div className="appBrandIcon" aria-hidden="true"><img src="/tarea-logo.svg" alt="" /></div>
          <div className="appDownloadCopy">
            <p className="sectionKicker">TAKE TAREA WITH YOU</p>
            <h2 id="app-title">Book, manage, and track every job from your phone.</h2>
            <p>The Tarea app keeps your diagnosis, matched Pros, schedule, messages, and receipts close at hand.</p>
          </div>
          <div className="storeButtons" aria-label="Download the Tarea app">
            <a className="storeBadge appleBadge" href="https://apps.apple.com/app/id6784023441" target="_blank" rel="noopener noreferrer" aria-label="Download Tarea on the App Store">
              <span className="appleMark" aria-hidden="true"></span>
              <span><small>Download on the</small><strong>App Store</strong></span>
            </a>
            <a className="storeBadge playBadge" href="https://play.google.com/store/apps/details?id=com.taptarea.customer" target="_blank" rel="noopener noreferrer" aria-label="Get Tarea on Google Play">
              <span className="playMark" aria-hidden="true"><i /></span>
              <span><small>GET IT ON</small><strong>Google Play</strong></span>
            </a>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="shell footerMain">
          <div className="footerBrand"><Logo /><p>The smarter way to get home repairs done.<br />Fixed labor prices. Qualified local Pros.<br />You&apos;re in control.</p></div>
          <div><strong>Customers</strong><Link href="/diagnose">Diagnose an issue</Link><Link href="/browse">Browse Pros</Link><a href="#choice">Choose a Pro</a></div>
          <div><strong>Pros</strong><Link href="/register?role=handyman">Become a Pro</Link><a href="#pros">How matching works</a><Link href="/handyman/onboarding">Pro resources</Link></div>
          <div><strong>Company</strong><Link href="/contact">About Tarea</Link><Link href="/guarantee">Trust &amp; safety</Link><Link href="/guarantee">Disputes &amp; resolutions</Link><Link href="/contact">Help center</Link></div>
        </div>
        <div className="shell footerBottom">
          <span>© 2026 Tarea. All rights reserved.</span>
          <span className="footerTrust">
            Payments are processed by Stripe. Tarea never receives or stores your card number,
            and pro payouts go directly through Stripe — Tarea never sees bank details.
          </span>
          {/* Both stores require a reachable privacy policy, and the guarantee
              page is where the $5,000 cap, exclusions and claim deadline live —
              the section above promises it, so it has to be one click away. */}
          <span className="footerLegal">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/guarantee">ZenTarea Guarantee</Link>
            <Link href="/contact">Contact</Link>
          </span>
        </div>
      </footer>
    </main>
  );
}
