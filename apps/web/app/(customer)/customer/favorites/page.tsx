"use client";

import { useState, useEffect } from "react";
import { cld } from "@/lib/cld";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Heart, Star, MapPin, Loader2, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

type Favorite = {
  id: string;
  handyman: {
    id: string;
    bio: string | null;
    rating: number;
    totalJobs: number;
    hourlyRate: number;
    isPremium: boolean;
    isVerified: boolean;
    user: { id: string; name: string; avatarUrl: string | null; city: string | null };
    services: { id: string; title: string; minPrice: number; maxPrice: number; category: string }[];
  };
};

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/favorites")
      .then(r => r.json())
      .then(d => { setFavorites(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const remove = async (handymanId: string) => {
    setRemoving(handymanId);
    await fetch(`/api/favorites/${handymanId}`, { method: "DELETE" });
    setFavorites(prev => prev.filter(f => f.handyman.id !== handymanId));
    toast.success("Removed from favorites");
    setRemoving(null);
  };

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-6">

      <motion.div variants={fadeUp}>
        <h1 className="text-3xl font-extrabold text-white">Saved Handymen</h1>
        <p className="text-slate-400 mt-1">Your favorited service providers</p>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 text-tarea-sky animate-spin" />
        </div>
      ) : favorites.length === 0 ? (
        <motion.div variants={fadeUp} className="bg-white/5 border border-white/10 rounded-2xl p-16 text-center space-y-4">
          <Heart className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-slate-400 text-lg">No saved handymen yet.</p>
          <Link href="/customer/browse" className="btn-secondary inline-block">Browse Handymen</Link>
        </motion.div>
      ) : (
        <motion.div variants={stagger} className="grid md:grid-cols-2 gap-5">
          <AnimatePresence>
            {favorites.map(({ id, handyman: h }) => (
              <motion.div
                key={id}
                variants={fadeUp}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.25 } }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-tarea-sky/20 transition-colors"
              >
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-tarea-sky/20 flex items-center justify-center overflow-hidden">
                      {h.user.avatarUrl
                        ? <img src={cld(h.user.avatarUrl)} alt={h.user.name} className="w-full h-full object-cover" />
                        : <span className="text-2xl font-bold text-tarea-sky">{h.user.name[0]}</span>}
                    </div>
                    {h.isPremium && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-tarea-ink text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">PRO</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-white font-bold">{h.user.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-amber-400 text-sm font-semibold">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            {h.rating.toFixed(1)}
                            <span className="text-slate-500 font-normal">({h.totalJobs})</span>
                          </span>
                          {h.user.city && (
                            <span className="flex items-center gap-1 text-slate-500 text-xs">
                              <MapPin className="w-3 h-3" /> {h.user.city}
                            </span>
                          )}
                        </div>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => remove(h.id)}
                        disabled={removing === h.id}
                        className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        title="Remove from favorites"
                      >
                        <Heart className="w-5 h-5 fill-current" />
                      </motion.button>
                    </div>

                    {h.bio && (
                      <p className="text-slate-400 text-xs mt-2 line-clamp-2">{h.bio}</p>
                    )}

                    {h.services.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {h.services.slice(0, 3).map(s => (
                          <span key={s.id} className="text-xs bg-white/5 border border-white/10 text-slate-400 px-2 py-0.5 rounded-full">
                            {formatCurrency(s.minPrice)}–{formatCurrency(s.maxPrice)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="flex-1">
                    <Link
                      href={`/customer/handymen/${h.user.id}`}
                      className="flex items-center justify-center gap-1.5 bg-tarea-sky text-tarea-ink font-bold text-sm py-2.5 rounded-xl hover:bg-sky-300 transition-colors w-full"
                    >
                      <Zap className="w-4 h-4" /> Book Now
                    </Link>
                  </motion.div>
                  <Link
                    href="/customer/browse"
                    className="px-4 py-2.5 bg-white/5 border border-white/10 text-slate-400 text-sm font-medium rounded-xl hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Browse More
                  </Link>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}
