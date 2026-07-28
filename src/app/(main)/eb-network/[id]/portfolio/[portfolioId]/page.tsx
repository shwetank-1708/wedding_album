"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getWebTemplateComponent } from "@/components/templateRegistry";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { Business, BusinessPortfolioMedia, Event, getBusinessById } from "@/lib/database";
import { getWebLightboxTheme } from "@/lib/webTemplateTheme";

const DEFAULT_PORTFOLIO_COVER_IMAGE = "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop";

function formatPortfolioDate(date?: string) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

export default function PublicPortfolioEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string; portfolioId: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const data = await getBusinessById(params.id);
      if (!cancelled) {
        setBusiness(data);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const portfolio = business?.portfolioEvents?.find((item) => item.id === params.portfolioId);
  const templateId = portfolio?.templateId || "hero";
  const TemplateComponent = getWebTemplateComponent(templateId);

  const goBack = (fallback = "/eb-network") => {
    const returnTo = searchParams.get("returnTo");
    if (returnTo?.startsWith("/")) {
      router.push(returnTo);
      return;
    }
    if (fallback) {
      router.push(fallback);
      return;
    }
    router.back();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
      </div>
    );
  }

  if (!business || !portfolio) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 text-center text-white">
        <h1 className="text-2xl font-black">Portfolio event not found.</h1>
        <button onClick={() => goBack()} className="mt-5 rounded-full bg-indigo-400 px-5 py-3 text-sm font-black text-[#101010]">
          Back to EB Network
        </button>
      </div>
    );
  }

  const portfolioEvent: Event = {
    id: portfolio.id,
    title: portfolio.name,
    date: formatPortfolioDate(portfolio.date),
    coverImage: portfolio.coverImage || DEFAULT_PORTFOLIO_COVER_IMAGE,
    description: `${business.name} portfolio event`,
    type: "sub",
    category: portfolio.type,
    templateId,
    coverOffset: portfolio.coverOffset,
    coverOffsetX: portfolio.coverOffsetX,
    coverScale: portfolio.coverScale,
    coverMode: portfolio.coverMode,
  };

  const photos = (portfolio.media || []).map((media: BusinessPortfolioMedia, index) => ({
    id: media.id,
    src: media.url,
    width: 900,
    height: 900,
    filename: `${portfolio.name || "portfolio"}-${index + 1}`,
    alt: `${portfolio.name} portfolio media ${index + 1}`,
    mediaType: media.type === "video" ? "video" as const : "photo" as const,
    resourceType: media.type === "video" ? "video" : "image",
  }));

  const galleryBlock = photos.length > 0 ? (
    <MasonryGrid
      photos={photos}
      eventSlug={business.id}
      lightboxTheme={getWebLightboxTheme(templateId)}
      templateId={templateId}
    />
  ) : (
    <div className="mx-auto flex min-h-64 max-w-4xl items-center justify-center rounded-3xl border border-dashed border-white/15 bg-black/10 px-6 text-center">
      <span className="text-sm font-black uppercase tracking-[0.18em] opacity-60">No images uploaded yet.</span>
    </div>
  );

  return (
    <div className="relative min-h-screen">
      <button
        onClick={() => goBack("/eb-network")}
        className="fixed left-4 top-4 z-[80] flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-xl backdrop-blur transition hover:bg-black"
        aria-label="Back to EB Network"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <TemplateComponent
        event={portfolioEvent}
        photos={photos}
        isShared
      >
        {galleryBlock}
      </TemplateComponent>
    </div>
  );
}
