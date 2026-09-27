"use client";

import type React from "react";
import { TemplateBohemian } from "@/components/TemplateBohemian";
import { TemplateBrutalist } from "@/components/TemplateBrutalist";
import { TemplateCinematic } from "@/components/TemplateCinematic";
import { TemplateClassic } from "@/components/TemplateClassic";
import { TemplateEditorial } from "@/components/TemplateEditorial";
import { TemplateHero } from "@/components/TemplateHero";
import { TemplateMuseum } from "@/components/TemplateMuseum";
import { TemplatePolaroid } from "@/components/TemplatePolaroid";
import { TemplateRoyal } from "@/components/TemplateRoyal";
import { TemplateScrapbook } from "@/components/TemplateScrapbook";
import { TemplatePop } from "@/components/TemplatePop";
import { TemplateNeon } from "@/components/TemplateNeon";
import { TemplateCyberTech } from "@/components/TemplateCyberTech";
import { Event } from "@/lib/database";
import { makeUniversalTemplate } from "@/components/TemplateUniversal";

export type WebTemplateComponent = React.ComponentType<any>;

export const WEB_TEMPLATE_COMPONENTS: Record<string, WebTemplateComponent> = {
  hero: TemplateHero,
  classic: TemplateClassic,
  royal: TemplateRoyal,
  editorial: TemplateEditorial,
  bohemian: TemplateBohemian,
  polaroid: TemplatePolaroid,
  cinematic: TemplateCinematic,
  museum: TemplateMuseum,
  scrapbook: TemplateScrapbook,
  brutalist: TemplateBrutalist,
  pop: TemplatePop,
  neon: TemplateNeon,
  cyber_tech: TemplateCyberTech,

  ethereal: makeUniversalTemplate("ethereal"),
  pastel: makeUniversalTemplate("pastel"),
  golden_years: makeUniversalTemplate("golden_years"),
  vintage: makeUniversalTemplate("vintage"),
  rose: makeUniversalTemplate("rose"),
  minimal_love: makeUniversalTemplate("minimal_love"),
  diamond: makeUniversalTemplate("diamond"),
  blush: makeUniversalTemplate("blush"),
  garden: makeUniversalTemplate("garden"),
  midnight_glam: makeUniversalTemplate("midnight_glam"),
  modern_lounge: makeUniversalTemplate("modern_lounge"),
  elegant_night: makeUniversalTemplate("elegant_night"),
  tech_sleek: makeUniversalTemplate("tech_sleek"),
  executive: makeUniversalTemplate("executive"),
  vibrant: makeUniversalTemplate("vibrant"),
  zen: makeUniversalTemplate("zen"),
  retro_arcade: makeUniversalTemplate("retro_arcade"),
  academic_editorial: makeUniversalTemplate("academic_editorial"),
  neon_carnival: makeUniversalTemplate("neon_carnival"),
};

export function getWebTemplateComponent(templateId?: string): WebTemplateComponent {
  return WEB_TEMPLATE_COMPONENTS[templateId || "hero"] || TemplateHero;
}

export const WEB_TEMPLATE_IDS = Object.keys(WEB_TEMPLATE_COMPONENTS);
