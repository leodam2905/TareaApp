"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  motion, useScroll, useTransform, useInView,
  useMotionValue, useSpring, animate,
} from "framer-motion";
import {
  Zap, Paintbrush, Droplets, Wind, TreePine, Wrench,
  Star, Shield, Clock, CheckCircle2, ArrowRight,
  Phone, Mail, MapPin, Sparkles, Users, TrendingUp,
  ChevronDown,
} from "lucide-react";
import Logo from "@/components/ui/Logo";

// ─── Video Reel ───────────────────────────────────────────────────────────────

const VIDEO_SRCS = [
  "https://videos.pexels.com/video-files/9890450/9890450-hd_1920_1080_30fps.mp4",
  "https://videos.pexels.com/video-files/4334561/4334561-hd_1920_1080_24fps.mp4",
  "https://videos.pexels.com/video-files/5973234/5973234-hd_1920_1080_25fps.mp4",
  "https://videos.pexels.com/video-files/6474085/6474085-hd_1920_1080_25fps.mp4",
];

function VideoBg() {
  const [active, setActive] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    const id = setInterval(() => {
      setNext(p => ((p ?? active) + 1) % VIDEO_SRCS.length);
    }, 7000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (next === null) return;
    const v = videoRefs.current[next];
    if (v) { v.currentTime = 0; v.play().catch(() => {}); }
    const t = setTimeout(() => { setActive(next); setNext(null); }, 800);
    return () => clearTimeout(t);
  }, [next]);

  useEffect(() => {
    const v = videoRefs.current[active];
    if (v) { v.currentTime = 0; v.play().catch(() => {}); }
  }, [active]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {VIDEO_SRCS.map((src, i) => (
        <motion.video
          key={src}
          ref={el => { videoRefs.current[i] = el; }}
          src={src}
          muted
          loop
          playsInline
          initial={false}
          animate={{ opacity: i === active ? 1 : i === next ? 1 : 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ))}
      {/* Dark overlay so text stays readable */}
      <div className="absolute inset-0 bg-black/55" />
      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const services = [
  { icon: Droplets, label: "Plumbing",     desc: "Leaks, pipes & installations",    href: "/browse?category=PLUMBING",    from: "#3B82F6", to: "#06B6D4" },
  { icon: Zap,      label: "Electrical",   desc: "Wiring, panels & smart home",     href: "/browse?category=ELECTRICAL",  from: "#F59E0B", to: "#EF4444" },
  { icon: Wrench,   label: "Carpentry",    desc: "Furniture, floors & custom work",  href: "/browse?category=CARPENTRY",   from: "#F97316", to: "#F59E0B" },
  { icon: Paintbrush, label: "Painting",   desc: "Interior & exterior finishes",    href: "/browse?category=PAINTING",    from: "#EC4899", to: "#A855F7" },
  { icon: Wind,     label: "HVAC",         desc: "AC, heating & air quality",       href: "/browse?category=HVAC",        from: "#06B6D4", to: "#38BDF8" },
  { icon: TreePine, label: "Landscaping",  desc: "Lawn care & garden design",       href: "/browse?category=LANDSCAPING", from: "#22C55E", to: "#10B981" },
];

const steps = [
  { n: "01", title: "Choose a Service",  desc: "Browse categories and pick exactly what your home needs." },
  { n: "02", title: "Pick Your Pro",     desc: "View verified profiles, ratings, and transparent pricing." },
  { n: "03", title: "Book Instantly",    desc: "Select a time slot and get confirmed in seconds." },
  { n: "04", title: "Job Done Right",    desc: "Your handyman arrives on time and leaves your home spotless." },
];

const reviews = [
  { name: "Maria L.",   role: "Homeowner",         rating: 5, text: "The plumber fixed everything in under an hour. Tarea is now my go-to for any home issue." },
  { name: "James K.",   role: "Property Manager",  rating: 5, text: "I manage 12 units — Tarea saves me hours every week. Reliable, transparent, and fast." },
  { name: "Sofia R.",   role: "First-time User",   rating: 5, text: "The electrician was professional and thorough. Will definitely book again." },
  { name: "Carlos M.",  role: "Homeowner",         rating: 5, text: "Incredible service. The handyman arrived early and fixed three things I thought would take days." },
  { name: "Aisha T.",   role: "Interior Designer", rating: 5, text: "My clients rave about my renovation projects. Tarea pros are always top-tier." },
  { name: "Derek W.",   role: "Landlord",          rating: 5, text: "Tarea handymen are so reliable I've stopped keeping my own maintenance guy on retainer." },
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

  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 2, ease: "easeOut", onUpdate: v => setVal(Math.round(v)) });
    return c.stop;
  }, [inView, to]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ─── Review marquee ───────────────────────────────────────────────────────────

function Marquee() {
  const items = [...reviews, ...reviews];
  return (
    <div className="overflow-hidden">
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="flex gap-6 w-max"
      >
        {items.map((r, i) => (
          <div
            key={i}
            className="w-80 flex-shrink-0 bg-white border border-orange-100 rounded-2xl p-6 shadow-sm"
          >
            <div className="flex text-orange-400 mb-3 text-sm">{"★".repeat(r.rating)}</div>
            <p className="text-gray-600 text-sm leading-relaxed mb-5">"{r.text}"</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
                {r.name[0]}
              </div>
              <div>
                <p className="text-gray-900 font-semibold text-sm">{r.name}</p>
                <p className="text-gray-400 text-xs">{r.role}</p>
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY  = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOp = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen bg-[#FFF7ED] text-gray-900 overflow-x-hidden">

      {/* ── Navbar ── */}
      <motion.nav
        initial={mounted ? { y: -80, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="fixed top-0 inset-x-0 z-50"
      >
        <div className="mx-4 mt-4">
          <div className="max-w-6xl mx-auto bg-white/80 backdrop-blur-xl border border-orange-200 rounded-2xl px-6 h-14 flex items-center justify-between shadow-[0_4px_20px_rgba(251,146,60,0.12)]">
            <div className="flex items-center gap-2.5">
              <Logo size={32} />
            </div>
            <div className="hidden md:flex items-center gap-7 text-sm text-gray-500">
              {[["Services", "#services"], ["How it works", "#how-it-works"], ["Reviews", "#reviews"]].map(([l, h]) => (
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

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 w-full text-center">

            <motion.div
              initial={mounted ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5 text-white text-sm font-semibold mb-8"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Trusted by 10,000+ homeowners
            </motion.div>

            <motion.h1
              initial={mounted ? { opacity: 0, y: 30 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.8 }}
              className="text-6xl lg:text-7xl font-extrabold leading-[1.04] tracking-tight mb-6 text-white"
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
              className="text-white/80 text-lg leading-relaxed max-w-xl mx-auto mb-10"
            >
              Connect with verified, skilled handymen in your area — from plumbing to painting, booked in minutes.
            </motion.p>

            <motion.div
              initial={mounted ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="flex flex-col sm:flex-row gap-4 mb-12 justify-center"
            >
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-4 rounded-2xl text-base shadow-[0_0_40px_rgba(249,115,22,0.5)] hover:shadow-[0_0_60px_rgba(249,115,22,0.7)] transition-all duration-300"
                >
                  Book a Handyman <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/register?role=HANDYMAN"
                  className="flex items-center justify-center gap-2 border-2 border-white/40 text-white font-bold px-8 py-4 rounded-2xl text-base hover:bg-white/10 backdrop-blur-sm transition-all duration-300"
                >
                  Join as a Pro
                </Link>
              </motion.div>
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
                <p className="text-white/60 text-xs mt-0.5">4.9 · 3,200+ reviews</p>
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
      <section className="border-y border-orange-100 bg-orange-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { to: 10000, suffix: "+", label: "Happy Customers", icon: Users },
              { to: 2000,  suffix: "+", label: "Verified Pros",   icon: Shield },
              { to: 50,    suffix: "+", label: "Service Types",   icon: Wrench },
              { to: 49,    suffix: "",  label: "Avg Rating ★",    icon: TrendingUp, display: "4.9" },
            ].map(({ to, suffix, label, icon: Icon, display }, i) => (
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
                  {display ?? <Counter to={to} suffix={suffix} />}
                </p>
                <p className="text-gray-500 text-sm">{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="py-28 relative">
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
              className="text-5xl font-extrabold text-gray-900"
            >
              Every Service You Need
            </motion.h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {services.map(({ icon: Icon, label, desc, href, from, to }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <TiltCard>
                  <Link href={href}>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="relative group bg-white border border-orange-100 rounded-2xl p-6 overflow-hidden cursor-pointer hover:border-orange-200 hover:shadow-md transition-all duration-300"
                    >
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                        style={{ background: `radial-gradient(circle at 50% 0%, ${from}10 0%, transparent 70%)` }}
                      />
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                        style={{ background: `linear-gradient(135deg, ${from}20, ${to}20)`, border: `1px solid ${from}30` }}
                      >
                        <Icon className="w-6 h-6" style={{ color: from }} />
                      </div>
                      <h3 className="text-gray-900 font-bold text-lg mb-1">{label}</h3>
                      <p className="text-gray-500 text-sm mb-4">{desc}</p>
                      <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: from }}>
                        Browse <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.div>
                  </Link>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-28 bg-orange-50/40 border-y border-orange-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-orange-500 text-sm font-semibold uppercase tracking-widest mb-3"
            >
              Simple process
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-5xl font-extrabold text-gray-900"
            >
              How Tarea Works
            </motion.h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8 relative">
            <div className="hidden md:block absolute top-10 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-orange-300 to-transparent" />
            {steps.map(({ n, title, desc }, i) => (
              <motion.div
                key={n}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center relative"
              >
                <motion.div
                  whileHover={{ scale: 1.08, rotate: 3 }}
                  className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-200 border border-orange-300 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(251,146,60,0.15)]"
                >
                  <span className="text-orange-600 font-extrabold text-2xl">{n}</span>
                </motion.div>
                <h3 className="text-gray-900 font-bold text-lg mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust ── */}
      <section className="py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
                  <div className="h-full bg-white border border-orange-100 rounded-2xl p-8 hover:border-orange-300 hover:shadow-md transition-all duration-300">
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
      <section id="reviews" className="py-28 bg-orange-50/40 border-y border-orange-100 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="text-center">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-orange-500 text-sm font-semibold uppercase tracking-widest mb-3"
            >
              Customer love
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-5xl font-extrabold text-gray-900"
            >
              What People Are Saying
            </motion.h2>
          </div>
        </div>
        <Marquee />
      </section>

      {/* ── For handymen ── */}
      <section className="py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-amber-50" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-orange-500 text-sm font-semibold uppercase tracking-widest mb-4">For professionals</p>
              <h2 className="text-5xl font-extrabold text-gray-900 mb-5 leading-tight">
                Grow Your Business<br />with Tarea
              </h2>
              <p className="text-gray-600 leading-relaxed mb-8">
                Join thousands of skilled handymen earning more — on their own schedule, with zero marketing spend. We bring the customers, you do the work.
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
                  className="flex items-start gap-4 bg-white border border-orange-100 rounded-xl p-4 hover:border-orange-200 hover:shadow-sm transition-all"
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
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#7C2D12] via-[#9A3412] to-[#7C2D12]" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse at 50% 50%, rgba(251,146,60,0.25) 0%, transparent 65%)" }} />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-orange-500/15 blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 max-w-3xl mx-auto px-4 text-center"
        >
          <h2 className="text-6xl font-extrabold text-white mb-5 leading-tight">
            Ready to Get<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #FDBA74, #FB923C)" }}>
              Things Fixed?
            </span>
          </h2>
          <p className="text-orange-100/80 text-xl mb-12 leading-relaxed">
            Join thousands of homeowners who trust Tarea for every home repair need.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-orange-50 border-t border-orange-200 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Logo size={32} />
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
                    <Link href={`/browse?category=${s.toUpperCase()}`} className="hover:text-gray-900 transition-colors">{s}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-orange-600 font-bold text-sm uppercase tracking-wider mb-4">Company</h4>
              <ul className="space-y-2.5 text-gray-500 text-sm">
                {["About Us", "Careers", "Blog", "Press", "Partners"].map(item => (
                  <li key={item}><Link href="#" className="hover:text-gray-900 transition-colors">{item}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-orange-600 font-bold text-sm uppercase tracking-wider mb-4">Contact</h4>
              <ul className="space-y-3 text-gray-500 text-sm">
                <li className="flex items-center gap-2.5"><Phone className="w-4 h-4 flex-shrink-0" /><a href="tel:+15304391054" className="hover:text-gray-900 transition-colors">+1 (530) 439-1054</a></li>
                <li className="flex items-center gap-2.5"><Mail className="w-4 h-4 flex-shrink-0" /><Link href="/contact" className="hover:text-gray-900 transition-colors">support@taptarea.com</Link></li>
                <li className="flex items-center gap-2.5"><MapPin className="w-4 h-4 flex-shrink-0" /><span>Pasadena, California</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-orange-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">© 2026 Tarea. All rights reserved.</p>
            <div className="flex gap-6 text-gray-500 text-sm">
              <Link href="/contact" className="hover:text-gray-900 transition-colors">Contact & Support</Link>
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
  );
}
