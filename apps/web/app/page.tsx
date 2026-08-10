"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  motion, MotionConfig, useScroll, useTransform, useInView,
  useMotionValue, useSpring, useReducedMotion, animate,
} from "framer-motion";
import {
  Star, Shield, Clock, CheckCircle2, ArrowRight,
  Phone, Mail, MapPin, Sparkles, Users, TrendingUp,
  ChevronDown, Wrench, Search,
  Droplets, Zap, Paintbrush, Wind, TreePine, SprayCan,
  Truck, Shirt, Hammer, Settings2, Package,
} from "lucide-react";
import DiagnoseSection from "@/components/ui/DiagnoseSection";
import InstantQuoteSection from "@/components/ui/InstantQuoteSection";
import Logo from "@/components/ui/Logo";

// ─── Video Background ─────────────────────────────────────────────────────────

function VideoBg() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <video
        src="https://pub-adf5c223fa884cf6878a12b8f1ef7d2f.r2.dev/hero/hero-video.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const services: { Icon: React.ElementType; label: string; desc: string; href: string; from: string; rate: string; img?: string }[] = [
  { Icon: Droplets,  label: "Plumbing",           desc: "Leaks, pipes & installations",     href: "/register?category=PLUMBING",    from: "#3B82F6", rate: "$75–$150/hr", img: "/plumbing.png" },
  { Icon: Zap,       label: "Electrical",          desc: "Wiring, panels & smart home",      href: "/register?category=ELECTRICAL",  from: "#F59E0B", rate: "$80–$150/hr", img: "/electrical.png" },
  { Icon: Hammer,    label: "Carpentry",           desc: "Furniture, floors & custom work",  href: "/register?category=CARPENTRY",   from: "#F97316", rate: "$50–$100/hr", img: "/carpentry.png" },
  { Icon: Paintbrush,label: "Painting",            desc: "Interior & exterior finishes",     href: "/register?category=PAINTING",    from: "#EC4899", rate: "$40–$80/hr", img: "/painting.png"  },
  { Icon: Wind,      label: "HVAC",                desc: "AC, heating & air quality",        href: "/register?category=HVAC",        from: "#06B6D4", rate: "$80–$150/hr", img: "/hvac.png?v=2" },
  { Icon: TreePine,  label: "Landscaping",         desc: "Lawn care & garden design",        href: "/register?category=LANDSCAPING", from: "#22C55E", rate: "$35–$65/hr", img: "/landscaping.png"  },
  { Icon: SprayCan,  label: "Cleaning",            desc: "Deep clean, recurring & move-out", href: "/register?category=CLEANING",    from: "#10B981", rate: "$25–$50/hr", img: "/cleaning.png"  },
  { Icon: Truck,     label: "Moving",              desc: "Local moves, packing & hauling",   href: "/register?category=MOVING",      from: "#6366F1", rate: "$90–$140/hr", img: "/moving.png" },
  { Icon: Shirt,     label: "Wash & Fold",         desc: "Laundry pickup, wash & delivery",  href: "/register?category=CLEANING",    from: "#0EA5E9", rate: "$1.50–$2/lb", img: "/wash-fold.png" },
  { Icon: Wrench,    label: "Assembly & Mounting", desc: "Furniture, TV mounts & shelves",   href: "/register?category=GENERAL",     from: "#A855F7", rate: "$50–$100/hr", img: "/mounting.png" },
  { Icon: Settings2, label: "General",             desc: "Odd jobs & home repairs",          href: "/register?category=GENERAL",     from: "#F43F5E", rate: "$50–$90/hr", img: "/general.png"  },
];

const steps = [
  { n: "01", title: "Choose a Service",  desc: "Browse categories and pick exactly what your home needs." },
  { n: "02", title: "Pick Your Pro",     desc: "View verified profiles, ratings, and transparent pricing." },
  { n: "03", title: "Book Instantly",    desc: "Select a time slot and get confirmed in seconds." },
  { n: "04", title: "Job Done Right",    desc: "Your handyman arrives on time and leaves your home spotless." },
];

const highlights = [
  { title: "Verified professionals", text: "Every pro is identity-verified and background-checked before they can accept a single job." },
  { title: "Upfront pricing",        text: "See transparent hourly ranges before you book — no surprise fees once the work is done." },
  { title: "Book in minutes",        text: "Browse categories, pick a pro, and confirm a time slot in just a few taps." },
  { title: "Or let us match you",    text: "Not sure who to pick? Tell us the job and we'll source and vet the right pro for you." },
  { title: "Secure by design",       text: "Payments, messaging, and scheduling all happen safely inside the platform." },
  { title: "Real support",           text: "Questions before or after a job? Our support team and AI assistant are here to help." },
];

const stats: { to?: number; suffix?: string; display?: string; label: string; icon: React.ElementType }[] = [
  { display: "Upfront", label: "Transparent Pricing",  icon: CheckCircle2 },
  { to: 10, suffix: "+",  label: "Service Categories",  icon: Wrench },
  { to: 100, suffix: "%", label: "Background-Checked",  icon: Shield },
  { to: 24, suffix: "/7", label: "AI Support",          icon: Sparkles },
];

const trust = [
  { icon: Shield,       title: "Verified Pros",        desc: "Every handyman is background-checked, licensed, and reviewed by our team." },
  { icon: Clock,        title: "On-Time Guarantee",    desc: "Arrives in the scheduled window — or your next booking is free." },
  { icon: CheckCircle2, title: "Satisfaction Promise", desc: "Not happy? We'll send another pro at no charge. Zero risk, every time." },
];

// ─── Animated background ──────────────────────────────────────────────────────

function MeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        animate={{ x: [0, 120, 0], y: [0, -60, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-32 left-1/4 w-[700px] h-[700px] rounded-full bg-orange-300/20 blur-[140px]"
      />
      <motion.div
        animate={{ x: [0, -100, 0], y: [0, 80, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute top-1/2 right-0 w-[600px] h-[600px] rounded-full bg-orange-400/10 blur-[120px]"
      />
      <motion.div
        animate={{ x: [0, 70, 0], y: [0, 50, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 8 }}
        className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-amber-300/10 blur-[100px]"
      />
    </div>
  );
}

// ─── Tilt card ────────────────────────────────────────────────────────────────

function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [12, -12]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-12, 12]), { stiffness: 300, damping: 30 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width - 0.5);
    y.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) { setVal(to); return; }
    const c = animate(0, to, { duration: 2, ease: "easeOut", onUpdate: v => setVal(Math.round(v)) });
    return c.stop;
  }, [inView, to, reduceMotion]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ─── Review marquee ───────────────────────────────────────────────────────────

function Marquee() {
  const items = [...highlights, ...highlights];
  return (
    <div className="overflow-hidden">
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="flex gap-6 w-max"
      >
        {items.map((h, i) => (
          <div
            key={i}
            className="w-80 flex-shrink-0 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-5 h-5 text-orange-500" />
            </div>
            <h3 className="text-gray-900 font-bold text-base mb-2">{h.title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{h.text}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Coming-soon store badges (app not yet publicly listed) ────────────────────

function StoreBadgePair({ tone }: { tone: "dark" | "glass" }) {
  const style =
    tone === "dark"
      ? "bg-black/40 border-white/15"
      : "bg-white/5 border-white/15";
  const badges = [
    { big: "App Store",   path: "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" },
    { big: "Google Play", path: "M3.18 23.76c.33.18.7.22 1.06.14L14.84 12 11 8.16 3.18 23.76zm17.34-10.93c.36-.26.6-.67.6-1.17 0-.46-.21-.86-.54-1.12l-2.29-1.33-4.14 4.14 3.8 3.8 2.57-4.32zM3.54.26C3.2.06 2.82 0 2.47.14L13.42 12 3.54.26zM2.47.14L13.42 12l1.42-1.42L3.6.05C3.23-.09 2.82.01 2.47.14z" },
  ];
  return (
    <div className="flex items-center gap-3 flex-wrap justify-center">
      {badges.map((b) => (
        <div
          key={b.big}
          aria-disabled="true"
          title="Mobile app coming soon"
          className={`flex items-center gap-2.5 border ${style} text-white/75 px-5 py-2.5 rounded-xl cursor-default select-none`}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0 opacity-70"><path d={b.path} /></svg>
          <div className="text-left">
            <div className="text-[9px] text-white/50 leading-none">Coming soon</div>
            <div className="text-sm font-bold leading-tight">{b.big}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY  = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  useEffect(() => setMounted(true), []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/register?q=${encodeURIComponent(q)}` : "/register");
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* ── Navbar ── */}
      <motion.nav
        initial={mounted ? { y: -80, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="fixed top-0 inset-x-0 z-50"
      >
        <div className="mx-4 mt-4">
          <div className="max-w-6xl mx-auto bg-white/90 backdrop-blur-xl border border-gray-200 rounded-2xl px-6 h-16 flex items-center justify-between shadow-[0_4px_20px_rgba(15,23,42,0.06)]">
            <Link href="/" className="flex items-center">
              <Logo size={48} />
            </Link>
            <div className="hidden md:flex items-center gap-7 text-sm text-gray-500">
              {[["Services", "#services"], ["How it works", "#how-it-works"], ["Why Tarea", "#reviews"]].map(([l, h]) => (
                <a key={l} href={h} className="hover:text-gray-900 transition-colors">{l}</a>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Log in</Link>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
                <Link href="/register" className="bg-tarea-dark text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-tarea-dark-deeper transition-colors">
                  Get Started
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center">
        {/* Video background */}
        <motion.div style={{ y: heroY }} className="absolute inset-0">
          <VideoBg />
        </motion.div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 w-full text-center">

            <motion.div
              initial={mounted ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5 text-white text-sm font-semibold mb-8"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Verified, background-checked pros
            </motion.div>

            <motion.h1
              initial={mounted ? { opacity: 0, y: 30 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.8 }}
              className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 text-white"
              style={{ lineHeight: 1.1 }}
            >
              Your Home,{" "}
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(135deg, #FB923C 0%, #FDBA74 50%, #FB923C 100%)", backgroundSize: "200%", animation: "shimmer 4s linear infinite" }}
              >
                Perfectly
              </span>
              <br />
              Maintained.
            </motion.h1>

            <motion.p
              initial={mounted ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-white/80 text-lg leading-relaxed max-w-xl mx-auto mb-8"
            >
              Connect with verified, skilled handymen in your area — from plumbing to painting, booked in minutes.
            </motion.p>

            {/* Search bar — primary hero CTA */}
            <motion.form
              onSubmit={onSearch}
              initial={mounted ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="relative max-w-2xl mx-auto mb-6"
            >
              <label htmlFor="hero-search" className="sr-only">Search for a service</label>
              <input
                id="hero-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                placeholder="Search for any service…"
                className="w-full h-14 sm:h-16 pl-6 pr-16 rounded-2xl bg-white text-gray-900 placeholder:text-gray-400 text-base sm:text-lg shadow-2xl outline-none focus:ring-4 focus:ring-orange-500/40 transition"
              />
              <button
                type="submit"
                aria-label="Search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-xl bg-tarea-dark hover:bg-tarea-dark-deeper text-white transition-colors cursor-pointer"
              >
                <Search className="w-5 h-5" />
              </button>
            </motion.form>

            {/* Popular category pills */}
            <motion.div
              initial={mounted ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex flex-wrap gap-2.5 mb-10 max-w-2xl mx-auto justify-center"
            >
              {services.slice(0, 6).map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="group inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/25 hover:border-white/50 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full transition-all cursor-pointer"
                >
                  {label}
                  <ArrowRight className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))}
            </motion.div>

            {/* App store badges */}
            <motion.div
              initial={mounted ? { opacity: 0, y: 16 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
              className="flex flex-col items-center gap-3 mb-10"
            >
              <p className="text-white/50 text-xs font-medium uppercase tracking-widest">Mobile apps coming soon</p>
              <StoreBadgePair tone="dark" />
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={mounted ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
              className="flex items-center gap-4 justify-center"
            >
              <div className="flex -space-x-2.5">
                {["J", "M", "A", "S", "D"].map((l, i) => (
                  <motion.div
                    key={l}
                    initial={mounted ? { scale: 0 } : false}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.9 + i * 0.08 }}
                    className="w-9 h-9 rounded-full border-2 border-white/30 bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold"
                  >
                    {l}
                  </motion.div>
                ))}
              </div>
              <div className="text-left">
                <div className="flex text-orange-400 text-sm">★★★★★</div>
                <p className="text-white/60 text-xs mt-0.5">Verified · Licensed &amp; insured</p>
              </div>
            </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={mounted ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>
              <ChevronDown className="w-5 h-5 text-white/50" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative mx-4 sm:mx-6 lg:mx-auto max-w-7xl my-8 rounded-3xl border border-gray-200 bg-gray-50 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map(({ to, suffix, label, icon: Icon, display }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-10 h-10 bg-orange-100 border border-orange-200 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-4xl font-extrabold text-gray-900 mb-1">
                  {display ?? <Counter to={to ?? 0} suffix={suffix} />}
                </p>
                <p className="text-gray-500 text-sm">{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="relative mx-4 sm:mx-6 lg:mx-auto max-w-7xl my-8 rounded-3xl border border-white/10 bg-[#1E3A8A] overflow-hidden py-16 sm:py-24">
        <MeshBackground />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-orange-500 text-sm font-semibold uppercase tracking-widest mb-3"
            >
              What we fix
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-5xl font-extrabold text-white"
            >
              Every Service You Need
            </motion.h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {services.map(({ Icon, label, desc, href, from, rate, img }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <Link href={href}>
                  <TiltCard>
                    <motion.div
                      whileHover={{ y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="group bg-white border border-gray-200 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-all"
                    >
                      {/* Top: line-art illustration (test on Plumbing) or colored icon band */}
                      {img ? (
                        <div className="flex items-center justify-center bg-white h-28 px-4 pt-3">
                          <img src={img} alt={label} className="max-h-full w-auto object-contain" />
                        </div>
                      ) : (
                        <div
                          className="flex flex-col items-center justify-center pt-6 pb-4"
                          style={{ background: `linear-gradient(135deg, ${from}18 0%, ${from}08 100%)` }}
                        >
                          <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md mb-1"
                            style={{ background: `linear-gradient(135deg, ${from}22, ${from}44)`, border: `2px solid ${from}44`, boxShadow: `0 6px 20px ${from}30` }}
                          >
                            <Icon className="w-8 h-8" style={{ color: from }} strokeWidth={1.5} />
                          </div>
                        </div>
                      )}
                      {/* White bottom with text */}
                      <div className="px-4 pt-3 pb-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <h3 className="text-gray-900 font-bold text-sm leading-tight">{label}</h3>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: `${from}15`, color: from }}
                          >
                            {rate}
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs leading-snug mb-3">{desc}</p>
                        <div className="flex items-center justify-center gap-1 text-xs font-semibold" style={{ color: from }}>
                          Book Now <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </motion.div>
                  </TiltCard>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Instant Quote ── */}
      <InstantQuoteSection />

      {/* ── How it works ── */}
      <section id="how-it-works" className="relative mx-4 sm:mx-6 lg:mx-auto max-w-7xl my-8 rounded-3xl overflow-hidden bg-gradient-to-br from-[#1E3A8A] via-[#1E3A8A] to-[#0F2560] px-8 sm:px-14 py-14 sm:py-16">

        {/* How Tarea Works */}
        <div className="text-center mb-12">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-orange-300 text-sm font-semibold uppercase tracking-widest mb-3"
          >
            Two ways to get it done
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl sm:text-5xl font-extrabold text-white"
          >
            How <span className="logo-script">Tarea</span> Works
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {[
            {
              tag: "Way 1", Icon: Search, title: "Book a pro yourself",
              blurb: "For when you know exactly what you need.",
              points: ["Browse services & compare verified pros", "Pick your handyman with upfront pricing", "Book instantly — sorted in minutes"],
            },
            {
              tag: "Way 2", Icon: Sparkles, title: "Let Tarea match you",
              blurb: "For when you'd rather we handle it.",
              points: ["Tell us what you need", "We source, vet & send the right pro", "Sit back — the job gets done"],
            },
          ].map(({ tag, Icon, title, blurb, points }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8"
            >
              <div className="flex items-center gap-3.5 mb-5">
                <Link
                  href="/register"
                  aria-label={`Get started — ${title}`}
                  className="w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-500/25 hover:bg-orange-500/30 hover:border-orange-500/50 flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer"
                >
                  <Icon className="w-6 h-6 text-orange-400" />
                </Link>
                <div>
                  <p className="text-orange-300 text-xs font-bold uppercase tracking-widest">{tag}</p>
                  <h3 className="text-white font-extrabold text-xl leading-tight">{title}</h3>
                </div>
              </div>
              <p className="text-white/60 text-sm mb-6">{blurb}</p>
              <ol className="space-y-3.5">
                {points.map((p, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <span className="w-6 h-6 flex-shrink-0 rounded-full bg-white/10 border border-white/15 text-white text-xs font-bold flex items-center justify-center">{j + 1}</span>
                    <span className="text-white/85 text-sm leading-relaxed">{p}</span>
                  </li>
                ))}
              </ol>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── AI Diagnose ── */}
      <DiagnoseSection />

      {/* ── Trust ── */}
      <section className="relative mx-4 sm:mx-6 lg:mx-auto max-w-7xl my-8 rounded-3xl border border-white/10 bg-[#059669] overflow-hidden py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl sm:text-5xl font-extrabold text-white"
            >
              <span className="logo-script">Tarea</span>&apos;s Promise
            </motion.h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {trust.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
              >
                <TiltCard className="h-full">
                  <div className="h-full bg-white border border-gray-200 rounded-2xl p-8 hover:border-orange-300 hover:shadow-md transition-all duration-300">
                    <div className="w-14 h-14 bg-orange-100 border border-orange-200 rounded-2xl flex items-center justify-center mb-5">
                      <Icon className="w-7 h-7 text-orange-500" />
                    </div>
                    <h3 className="text-gray-900 font-bold text-xl mb-3">{title}</h3>
                    <p className="text-gray-600 leading-relaxed text-sm">{desc}</p>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Reviews ── */}
      <section id="reviews" className="relative mx-4 sm:mx-6 lg:mx-auto max-w-7xl my-8 rounded-3xl border border-gray-200 bg-gray-50 overflow-hidden py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="text-center">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-orange-500 text-sm font-semibold uppercase tracking-widest mb-3"
            >
              Why Tarea
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-5xl font-extrabold text-gray-900"
            >
              Built Around Trust
            </motion.h2>
          </div>
        </div>
        <Marquee />
      </section>

      {/* ── For handymen ── */}
      <section className="relative mx-4 sm:mx-6 lg:mx-auto max-w-7xl my-8 rounded-3xl border border-white/10 bg-[#374151] overflow-hidden py-16 sm:py-24">
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-orange-500 text-sm font-semibold uppercase tracking-widest mb-4">For professionals</p>
              <h2 className="text-5xl font-extrabold text-white mb-5 leading-tight">
                Grow Your Business<br />with <span className="logo-script">Tarea</span>
              </h2>
              <p className="text-gray-300 leading-relaxed mb-8">
                Join skilled handymen earning more — on their own schedule, with zero marketing spend. We bring the customers, you do the work.
              </p>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/register?role=HANDYMAN"
                  className="inline-flex items-center gap-2 bg-tarea-dark text-white font-bold px-8 py-4 rounded-2xl text-base shadow-[0_0_40px_rgba(194,65,12,0.2)] hover:shadow-[0_0_60px_rgba(194,65,12,0.4)] transition-all duration-300"
                >
                  Start Earning Today <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              {[
                { icon: TrendingUp, title: "Instant Payouts",      desc: "Cash out your earnings to your debit card within 30 minutes, any time." },
                { icon: Users,      title: "Steady Job Flow",       desc: "Get matched with customers in your area automatically — no cold calls." },
                { icon: Shield,     title: "You're in Control",     desc: "Set your own rates, hours, and service radius. No contracts, ever." },
                { icon: Star,       title: "Build Your Reputation", desc: "Grow your ratings and unlock premium placement in search results." },
              ].map(({ icon: Icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-orange-200 hover:shadow-sm transition-all"
                >
                  <div className="w-10 h-10 bg-orange-100 border border-orange-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold mb-0.5">{title}</p>
                    <p className="text-gray-500 text-sm">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative mx-4 sm:mx-6 lg:mx-auto max-w-7xl my-8 rounded-3xl overflow-hidden py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-[#7C2D12] via-[#9A3412] to-[#7C2D12]" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse at 50% 50%, rgba(255,106,0,0.3) 0%, transparent 65%)" }} />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(255,106,0,0.18)" }}
        />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 max-w-3xl mx-auto px-4 text-center"
        >
          <h2 className="text-6xl font-extrabold text-white mb-5 leading-tight">
            Ready to Get<br />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: "linear-gradient(135deg, #FFB020, #FF6A00)",
                filter: "drop-shadow(0 0 18px rgba(255,106,0,0.75)) drop-shadow(0 0 48px rgba(255,106,0,0.45))",
              }}
            >
              Things Fixed?
            </span>
          </h2>
          <p className="text-orange-100/80 text-xl mb-12 leading-relaxed">
            Join homeowners who trust Tarea for every home repair need.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
              <Link
                href="/register"
                className="block text-center bg-white text-tarea-dark font-bold px-12 py-4 rounded-2xl text-lg shadow-2xl hover:shadow-white/20 transition-all duration-300"
              >
                Book Now — It's Free
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
              <Link
                href="/register?role=HANDYMAN"
                className="block text-center border-2 border-white/30 text-white font-bold px-12 py-4 rounded-2xl text-lg hover:bg-white/10 hover:border-white/50 transition-all duration-300"
              >
                Become a Handyman
              </Link>
            </motion.div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <p className="text-orange-200/60 text-xs font-medium uppercase tracking-widest">Mobile apps coming soon</p>
            <StoreBadgePair tone="glass" />
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-gray-200 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Logo size={36} />
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">
                Your trusted platform for home maintenance and repair services.
              </p>
            </div>
            <div>
              <h4 className="text-orange-600 font-bold text-sm uppercase tracking-wider mb-4">Services</h4>
              <ul className="space-y-2.5 text-gray-500 text-sm">
                {["Plumbing", "Electrical", "Carpentry", "Painting", "HVAC"].map(s => (
                  <li key={s}>
                    <Link href={`/register?category=${s.toUpperCase()}`} className="hover:text-gray-900 transition-colors">{s}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-orange-600 font-bold text-sm uppercase tracking-wider mb-4">Company</h4>
              <ul className="space-y-2.5 text-gray-500 text-sm">
                {[
                  { label: "Contact & Support", href: "/contact" },
                  { label: "ZenTarea Guarantee", href: "/guarantee" },
                  { label: "Privacy Policy",    href: "/privacy" },
                  { label: "Terms of Service",  href: "/terms" },
                  { label: "Delete Account",    href: "/delete-account" },
                ].map(({ label, href }) => (
                  <li key={label}><Link href={href} className="hover:text-gray-900 transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-orange-600 font-bold text-sm uppercase tracking-wider mb-4">Contact</h4>
              <ul className="space-y-3 text-gray-500 text-sm mb-6">
                <li className="flex items-center gap-2.5"><Phone className="w-4 h-4 flex-shrink-0" /><a href="tel:+15304391054" className="hover:text-gray-900 transition-colors">+1 (530) 439-1054</a></li>
                <li className="flex items-center gap-2.5"><Mail className="w-4 h-4 flex-shrink-0" /><Link href="/contact" className="hover:text-gray-900 transition-colors">support@taptarea.com</Link></li>
                <li className="flex items-center gap-2.5"><MapPin className="w-4 h-4 flex-shrink-0" /><span>Pasadena, California</span></li>
              </ul>
              <h4 className="text-orange-600 font-bold text-sm uppercase tracking-wider mb-3">Get the App</h4>
              <div className="flex flex-col gap-2">
                {[
                  { big: "App Store",   path: "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" },
                  { big: "Google Play", path: "M3.18 23.76c.33.18.7.22 1.06.14L14.84 12 11 8.16 3.18 23.76zm17.34-10.93c.36-.26.6-.67.6-1.17 0-.46-.21-.86-.54-1.12l-2.29-1.33-4.14 4.14 3.8 3.8 2.57-4.32zM3.54.26C3.2.06 2.82 0 2.47.14L13.42 12 3.54.26zM2.47.14L13.42 12l1.42-1.42L3.6.05C3.23-.09 2.82.01 2.47.14z" },
                ].map((b) => (
                  <div key={b.big} aria-disabled="true" title="Mobile app coming soon" className="flex items-center gap-2 bg-gray-900/80 text-white/75 px-3 py-2 rounded-lg w-fit cursor-default select-none">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0 opacity-70"><path d={b.path}/></svg>
                    <div>
                      <div className="text-[8px] text-white/50 leading-none">Coming soon</div>
                      <div className="text-xs font-bold leading-tight">{b.big}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">© 2026 <span className="logo-script">Tarea</span>. All rights reserved.</p>
            <div className="flex gap-6 text-gray-500 text-sm">
              <Link href="/contact" className="hover:text-gray-900 transition-colors">Contact & Support</Link>
              <Link href="/guarantee" className="hover:text-gray-900 transition-colors">ZenTarea Guarantee</Link>
              <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </div>
    </MotionConfig>
  );
}
