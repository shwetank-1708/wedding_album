import { MidnightColors } from './theme';

export interface TemplateTheme {
  id: string;
  category: string;
  label: string;
  desc: string;
  background: { light: string; dark: string };
  panel: { light: string; dark: string };
  text: { light: string; dark: string };
  muted: { light: string; dark: string };
  accent: string; // Accents usually stay consistent to maintain brand identity
  accentBg: { light: string; dark: string };
  tileBg: { light: string; dark: string };
  radius: number;
  overlay: { light: string[]; dark: string[] };
  useSerif?: boolean;
}

export const MOBILE_TEMPLATE_THEMES: TemplateTheme[] = [
  // WEDDING
  {
    id: 'royal',
    category: 'Wedding',
    label: 'Royal Emerald',
    desc: 'Deep imperial emerald & palace gold',
    background: { light: '#033026', dark: '#02231c' },
    panel: { light: 'rgba(2, 35, 28, 0.6)', dark: 'rgba(2, 35, 28, 0.8)' },
    text: { light: '#fcfbf7', dark: '#fcfbf7' },
    muted: { light: '#a3b899', dark: '#a3b899' },
    accent: '#ca9c69',
    accentBg: { light: 'rgba(202, 156, 105, 0.12)', dark: 'rgba(202, 156, 105, 0.18)' },
    tileBg: { light: '#02231c', dark: '#021a15' },
    radius: 18,
    overlay: { light: ['rgba(3, 48, 38, 0.25)', 'rgba(3, 48, 38, 1)'], dark: ['rgba(2, 35, 28, 0.25)', 'rgba(2, 35, 28, 1)'] },
    useSerif: true
  },
  {
    id: 'classic',
    category: 'Wedding',
    label: 'Classic White',
    desc: 'Timeless vintage sage & warm ivory elegance',
    background: { light: '#F7F2EB', dark: '#F7F2EB' }, // Warm silk ivory background
    panel: { light: '#ffffff', dark: '#ffffff' }, // Pure silk white card matting
    text: { light: '#2C352E', dark: '#2C352E' }, // Deep warm sage charcoal
    muted: { light: '#6E7B6C', dark: '#6E7B6C' }, // Muted sage gray
    accent: '#8B9A6E', // Muted vintage sage green
    accentBg: { light: 'rgba(139,154,110,0.08)', dark: 'rgba(139,154,110,0.08)' },
    tileBg: { light: '#ffffff', dark: '#ffffff' },
    radius: 0,
    overlay: { light: ['rgba(247,242,235,0.1)', 'rgba(247,242,235,1)'], dark: ['rgba(247,242,235,0.1)', 'rgba(247,242,235,1)'] },
    useSerif: true
  },
  {
    id: 'hero',
    category: 'Wedding',
    label: 'Midnight Hero',
    desc: 'Big impact cinematic dark aesthetic',
    background: { light: '#000000', dark: '#000000' }, // Locked to Obsidian/Midnight Black
    panel: { light: 'rgba(255,255,255,0.03)', dark: 'rgba(255,255,255,0.03)' }, // Premium graphite frosted glass
    text: { light: '#ffffff', dark: '#ffffff' }, // Stark starlight white
    muted: { light: '#94a3b8', dark: '#94a3b8' }, // Cool platinum gray
    accent: '#ca9c69', // Warm camel caramel gold
    accentBg: { light: 'rgba(202,156,105,0.08)', dark: 'rgba(202,156,105,0.1)' },
    tileBg: { light: '#09090b', dark: '#09090b' }, // Dark glassmorphism photo cards
    radius: 12, // High-end sleek rounded cards
    overlay: { light: ['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.95)'], dark: ['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.95)'] },
    useSerif: true
  },
  {
    id: 'ethereal',
    category: 'Wedding',
    label: 'Ethereal Mist',
    desc: 'Vintage fine-art album & steel blue',
    background: { light: '#F8FAFC', dark: '#F8FAFC' },
    panel: { light: '#EEF2F6', dark: '#EEF2F6' },
    text: { light: '#1E293B', dark: '#1E293B' },
    muted: { light: '#64748B', dark: '#64748B' },
    accent: '#4A6984',
    accentBg: { light: '#E2E8F0', dark: '#E2E8F0' },
    tileBg: { light: '#ffffff', dark: '#ffffff' },
    radius: 2,
    overlay: { light: ['rgba(248,250,252,0.15)', 'rgba(248,250,252,1)'], dark: ['rgba(248,250,252,0.15)', 'rgba(248,250,252,1)'] },
    useSerif: true
  },

  // BIRTHDAY
  {
    id: 'scrapbook',
    category: 'Birthday',
    label: 'Playful Scrapbook',
    desc: 'Soft modern keepsake aesthetic',
    background: { light: '#f8f5f0', dark: '#151c1b' },
    panel: { light: 'rgba(255, 255, 255, 0.78)', dark: 'rgba(246, 241, 232, 0.07)' },
    text: { light: '#263331', dark: '#f8f5f0' },
    muted: { light: '#74827d', dark: '#aab8b1' },
    accent: '#d9826b',
    accentBg: { light: 'rgba(217, 130, 107, 0.14)', dark: 'rgba(217, 130, 107, 0.18)' },
    tileBg: { light: '#fffdf9', dark: '#1d2826' },
    radius: 18,
    overlay: { light: ['rgba(248,245,240,0.04)', 'rgba(248,245,240,1)'], dark: ['rgba(21,28,27,0.18)', 'rgba(21,28,27,1)'] }
  },
  {
    id: 'neon',
    category: 'Birthday',
    label: 'Neon Party',
    desc: 'Premium neon birthday album',
    background: { light: '#070611', dark: '#070611' },
    panel: { light: 'rgba(18, 16, 35, 0.72)', dark: 'rgba(18, 16, 35, 0.72)' },
    text: { light: '#f8f7ff', dark: '#f8f7ff' },
    muted: { light: '#b9b1d9', dark: '#b9b1d9' },
    accent: '#ff3df2',
    accentBg: { light: 'rgba(102, 232, 255, 0.2)', dark: 'rgba(102, 232, 255, 0.2)' },
    tileBg: { light: 'rgba(17, 16, 32, 0.82)', dark: 'rgba(17, 16, 32, 0.82)' },
    radius: 20,
    overlay: { light: ['rgba(7,6,17,0.12)', 'rgba(7,6,17,1)'], dark: ['rgba(7,6,17,0.12)', 'rgba(7,6,17,1)'] }
  },
  {
    id: 'pastel',
    category: 'Birthday',
    label: 'Pastel Dream',
    desc: 'Dreamy pastel memory journal',
    background: { light: '#fff7f4', dark: '#fff7f4' },
    panel: { light: 'rgba(255, 255, 255, 0.74)', dark: 'rgba(255, 255, 255, 0.74)' },
    text: { light: '#4d4542', dark: '#4d4542' },
    muted: { light: '#9a8583', dark: '#9a8583' },
    accent: '#c9768b',
    accentBg: { light: 'rgba(213, 180, 220, 0.28)', dark: 'rgba(213, 180, 220, 0.28)' },
    tileBg: { light: '#fffdfb', dark: '#fffdfb' },
    radius: 24,
    overlay: { light: ['rgba(255,247,244,0.08)', 'rgba(255,247,244,1)'], dark: ['rgba(255,247,244,0.08)', 'rgba(255,247,244,1)'] }
  },
  {
    id: 'pop',
    category: 'Birthday',
    label: 'Pop Art',
    desc: 'Comic poster birthday album',
    background: { light: '#ffe84a', dark: '#ffe84a' },
    panel: { light: '#fffdf3', dark: '#fffdf3' },
    text: { light: '#231f20', dark: '#231f20' },
    muted: { light: '#5b4b3d', dark: '#5b4b3d' },
    accent: '#ef2b3a',
    accentBg: { light: 'rgba(0, 128, 255, 0.18)', dark: 'rgba(0, 128, 255, 0.18)' },
    tileBg: { light: '#ffffff', dark: '#ffffff' },
    radius: 18,
    overlay: { light: ['rgba(255,232,74,0.08)', 'rgba(255,232,74,1)'], dark: ['rgba(255,232,74,0.08)', 'rgba(255,232,74,1)'] }
  },

  // ANNIVERSARY
  {
    id: 'golden_years',
    category: 'Anniversary',
    label: 'Golden Years',
    desc: 'Rich dark amber & chocolate golden legacy journal',
    background: { light: '#fbf4e6', dark: '#160f09' },
    panel: { light: 'rgba(255, 251, 242, 0.86)', dark: '#241a10' },
    text: { light: '#3f2f22', dark: '#faf5ea' },
    muted: { light: '#8b765e', dark: '#bdab97' },
    accent: '#e5a93c',
    accentBg: { light: 'rgba(229, 169, 60, 0.14)', dark: 'rgba(229, 169, 60, 0.24)' },
    tileBg: { light: '#fffaf0', dark: '#241a10' },
    radius: 20,
    overlay: { light: ['rgba(251,244,230,0.1)', 'rgba(251,244,230,1)'], dark: ['rgba(22,15,9,0.24)', 'rgba(22,15,9,1)'] }
  },
  {
    id: 'vintage',
    category: 'Anniversary',
    label: 'Vintage Noir',
    desc: 'Dark archival anniversary journal',
    background: { light: '#0F0E0B', dark: '#0F0E0B' },
    panel: { light: '#1C1812', dark: '#1C1812' },
    text: { light: '#F2E7D2', dark: '#F2E7D2' },
    muted: { light: '#C7A96B', dark: '#C7A96B' },
    accent: '#B89145',
    accentBg: { light: 'rgba(184,145,69,0.14)', dark: 'rgba(184,145,69,0.16)' },
    tileBg: { light: '#15130F', dark: '#15130F' },
    radius: 2,
    overlay: { light: ['rgba(15,14,11,0.2)', 'rgba(15,14,11,1)'], dark: ['rgba(15,14,11,0.24)', 'rgba(15,14,11,1)'] }
  },
  {
    id: 'rose',
    category: 'Anniversary',
    label: 'Rose Garden',
    desc: 'Luxurious velvet burgundy & rose gold editorial journal',
    background: { light: '#fff9f5', dark: '#280a14' },
    panel: { light: 'rgba(255, 252, 247, 0.86)', dark: '#3b1622' },
    text: { light: '#562733', dark: '#fceee9' },
    muted: { light: '#9a6c74', dark: '#cfa89e' },
    accent: '#d8a47f',
    accentBg: { light: 'rgba(216, 164, 127, 0.13)', dark: 'rgba(216, 164, 127, 0.22)' },
    tileBg: { light: '#fffdfa', dark: '#3b1622' },
    radius: 28,
    overlay: { light: ['rgba(255,249,245,0.1)', 'rgba(255,249,245,1)'], dark: ['rgba(40,10,20,0.24)', 'rgba(40,10,20,1)'] }
  },
  {
    id: 'minimal_love',
    category: 'Anniversary',
    label: 'Minimal Love',
    desc: 'Minimal romantic dark editorial journal',
    background: { light: '#f7efe4', dark: '#1f1d1d' },
    panel: { light: '#fffaf2', dark: '#282422' },
    text: { light: '#3b2618', dark: '#f8f5f0' },
    muted: { light: '#8a7461', dark: '#b8aea5' },
    accent: '#ff5252',
    accentBg: { light: 'rgba(255, 82, 82, 0.12)', dark: 'rgba(255, 82, 82, 0.26)' },
    tileBg: { light: '#fffaf2', dark: '#282422' },
    radius: 24,
    overlay: { light: ['rgba(247,239,228,0.08)', 'rgba(247,239,228,1)'], dark: ['rgba(31,29,29,0.24)', 'rgba(31,29,29,1)'] }
  },

  // ENGAGEMENT (Mapped to Other)
  {
    id: 'bohemian',
    category: 'Other',
    label: 'Bohemian Rhapsody',
    desc: 'Vintage retro cream & olive green festival theme',
    background: { light: '#f3e8d3', dark: '#2f1b12' },
    panel: { light: '#fffdf9', dark: 'rgba(250,245,234,0.08)' },
    text: { light: '#38241b', dark: '#f3e8d3' },
    muted: { light: '#7d6457', dark: '#7d6457' },
    accent: '#73863a',
    accentBg: { light: 'rgba(115,134,58,0.15)', dark: 'rgba(115,134,58,0.2)' },
    tileBg: { light: '#fffdf9', dark: '#351f15' },
    radius: 22,
    overlay: { light: ['rgba(243,232,211,0.45)', 'rgba(243,232,211,1)'], dark: ['rgba(47,27,18,0.45)', 'rgba(47,27,18,1)'] }
  },
  {
    id: 'diamond',
    category: 'Other',
    label: 'Diamond Shine',
    desc: 'Cool blues and sparkle',
    background: { light: '#f0f9ff', dark: '#082f49' },
    panel: { light: '#ffffff', dark: 'rgba(2,132,199,0.05)' },
    text: { light: '#0c4a6e', dark: '#f0f9ff' },
    muted: { light: '#0369a1', dark: '#7dd3fc' },
    accent: '#0284c7',
    accentBg: { light: '#e0f2fe', dark: 'rgba(2,132,199,0.2)' },
    tileBg: { light: '#ffffff', dark: '#0c4a6e' },
    radius: 15,
    overlay: { light: ['rgba(240,249,255,0.1)', 'rgba(240,249,255,1)'], dark: ['rgba(8,47,73,0.2)', 'rgba(8,47,73,1)'] }
  },
  {
    id: 'blush',
    category: 'Other',
    label: 'Blush & Bashful',
    desc: 'Velvet burgundy & rose gold luxury editorial journal',
    background: { light: '#f5dfdb', dark: '#230a12' },
    panel: { light: '#ffffff', dark: 'rgba(54,18,31,0.85)' },
    text: { light: '#2b0d17', dark: '#f8e9e7' },
    muted: { light: '#8c5c56', dark: '#c4a5a0' },
    accent: '#d89c8a',
    accentBg: { light: 'rgba(216,156,138,0.15)', dark: 'rgba(216,156,138,0.2)' },
    tileBg: { light: '#ffffff', dark: '#36121f' },
    radius: 22,
    overlay: { light: ['rgba(245,223,219,0.45)', 'rgba(245,223,219,1)'], dark: ['rgba(35,10,18,0.45)', 'rgba(35,10,18,1)'] }
  },
  {
    id: 'garden',
    category: 'Other',
    label: 'Garden Path',
    desc: 'Misty botanical sage & leaf green natural theme',
    background: { light: '#e4ebe3', dark: '#3f4f40' },
    panel: { light: '#ffffff', dark: 'rgba(47,60,48,0.85)' },
    text: { light: '#222e23', dark: '#f0f5ef' },
    muted: { light: '#536855', dark: '#a1b39e' },
    accent: '#7a9a6b',
    accentBg: { light: 'rgba(122,154,107,0.15)', dark: 'rgba(122,154,107,0.2)' },
    tileBg: { light: '#ffffff', dark: '#344436' },
    radius: 22,
    overlay: { light: ['rgba(228,235,227,0.45)', 'rgba(228,235,227,1)'], dark: ['rgba(63,79,64,0.45)', 'rgba(63,79,64,1)'] },
    useSerif: true
  },

  // RECEPTION (Mapped to Other)
  {
    id: 'midnight_glam',
    category: 'Other',
    label: 'Midnight Glam',
    desc: 'Twilight indigo & deep violet nocturnal theme',
    background: { light: '#EFEBFB', dark: '#1A1035' },
    panel: { light: '#ffffff', dark: 'rgba(58,32,96,0.85)' },
    text: { light: '#1A1035', dark: '#F4F0FD' },
    muted: { light: '#6B5BBF', dark: '#9689C9' },
    accent: '#6B5BBF',
    accentBg: { light: 'rgba(107,91,191,0.15)', dark: 'rgba(107,91,191,0.2)' },
    tileBg: { light: '#ffffff', dark: '#3A2060' },
    radius: 16,
    overlay: { light: ['rgba(239,235,251,0.45)', 'rgba(239,235,251,1)'], dark: ['rgba(26,16,53,0.45)', 'rgba(26,16,53,1)'] }
  },
  {
    id: 'cinematic',
    category: 'Other',
    label: 'Cinematic Noir',
    desc: 'Vintage biker & dramatic crimson cinematic theme',
    background: { light: '#f5f5f5', dark: '#0f0f12' },
    panel: { light: '#ffffff', dark: 'rgba(28,28,32,0.85)' },
    text: { light: '#111113', dark: '#ffffff' },
    muted: { light: '#666670', dark: '#a0a0aa' },
    accent: '#e62b3a',
    accentBg: { light: 'rgba(230,43,58,0.15)', dark: 'rgba(230,43,58,0.2)' },
    tileBg: { light: '#ffffff', dark: '#1c1c20' },
    radius: 6,
    overlay: { light: ['rgba(245,245,245,0.45)', 'rgba(245,245,245,1)'], dark: ['rgba(15,15,18,0.45)', 'rgba(15,15,18,1)'] }
  },
  {
    id: 'modern_lounge',
    category: 'Other',
    label: 'Modern Lounge',
    desc: 'Dark mood blue & sleek steel architecture',
    background: { light: '#F0F4F8', dark: '#0D1117' },
    panel: { light: '#ffffff', dark: 'rgba(28,36,48,0.85)' },
    text: { light: '#0D1117', dark: '#A7B7C9' },
    muted: { light: '#3D5F8A', dark: '#798FAF' },
    accent: '#3D5F8A',
    accentBg: { light: 'rgba(61,95,138,0.15)', dark: 'rgba(61,95,138,0.2)' },
    tileBg: { light: '#ffffff', dark: '#1C2430' },
    radius: 16,
    overlay: { light: ['rgba(240,244,248,0.45)', 'rgba(240,244,248,1)'], dark: ['rgba(13,17,23,0.45)', 'rgba(13,17,23,1)'] }
  },
  {
    id: 'elegant_night',
    category: 'Other',
    label: 'Elegant Night',
    desc: 'Sophisticated design',
    background: { light: '#fafafa', dark: '#111111' },
    panel: { light: '#ffffff', dark: '#1a1a1a' },
    text: { light: '#171717', dark: '#ffffff' },
    muted: { light: '#737373', dark: '#cccccc' },
    accent: '#171717',
    accentBg: { light: 'rgba(0,0,0,0.05)', dark: 'rgba(255,255,255,0.05)' },
    tileBg: { light: '#ffffff', dark: '#111111' },
    radius: 0,
    overlay: { light: ['rgba(250,250,250,0.1)', 'rgba(250,250,250,1)'], dark: ['rgba(0,0,0,0.4)', 'rgba(17,17,17,1)'] }
  },

  // CORPORATE
  {
    id: 'museum',
    category: 'Corporate',
    label: 'Museum Gallery',
    desc: 'Luxury dark mood blue exhibition',
    background: { light: '#121820', dark: '#0D1117' },
    panel: { light: '#1C2430', dark: '#121820' },
    text: { light: '#A7B7C9', dark: '#A7B7C9' },
    muted: { light: '#798FAF', dark: '#798FAF' },
    accent: '#3D5F8A',
    accentBg: { light: 'rgba(61, 95, 138, 0.16)', dark: 'rgba(61, 95, 138, 0.2)' },
    tileBg: { light: '#1C2430', dark: '#121820' },
    radius: 22,
    overlay: { light: ['rgba(13,17,23,0.34)', 'rgba(18,24,32,0.96)'], dark: ['rgba(13,17,23,0.38)', 'rgba(13,17,23,1)'] }
  },
  {
    id: 'brutalist',
    category: 'Corporate',
    label: 'Brutalist Grid',
    desc: 'Modern architectural olive earth grid',
    background: { light: '#272921', dark: '#171914' },
    panel: { light: '#3B3C32', dark: '#272921' },
    text: { light: '#988B71', dark: '#E6DFD3' },
    muted: { light: '#5B5746', dark: '#988B71' },
    accent: '#988B71',
    accentBg: { light: 'rgba(152, 139, 113, 0.12)', dark: 'rgba(152, 139, 113, 0.2)' },
    tileBg: { light: '#3B3C32', dark: '#272921' },
    radius: 14,
    overlay: { light: ['rgba(23,25,20,0.5)', 'rgba(39,41,33,0.98)'], dark: ['rgba(23,25,20,0.32)', 'rgba(23,25,20,1)'] }
  },
  {
    id: 'tech_sleek',
    category: 'Corporate',
    label: 'Tech Sleek',
    desc: 'Deep ocean navy & electric cyan blue theme',
    background: { light: '#0a182b', dark: '#040c1a' },
    panel: { light: '#0e233d', dark: '#0a182b' },
    text: { light: '#00a2ff', dark: '#f0f8ff' },
    muted: { light: '#15365e', dark: '#7ba4cc' },
    accent: '#00a2ff',
    accentBg: { light: 'rgba(0, 162, 255, 0.16)', dark: 'rgba(0, 162, 255, 0.2)' },
    tileBg: { light: '#0e233d', dark: '#0a182b' },
    radius: 14,
    overlay: { light: ['rgba(4,12,26,0.5)', 'rgba(10,24,43,0.98)'], dark: ['rgba(4,12,26,0.32)', 'rgba(4,12,26,1)'] }
  },
  {
    id: 'executive',
    category: 'Corporate',
    label: 'Executive Suite',
    desc: 'Professional theme',
    background: { light: '#08111f', dark: '#08111f' },
    panel: { light: '#f5eddc', dark: '#f5eddc' },
    text: { light: '#f5eddc', dark: '#f5eddc' },
    muted: { light: '#d4b474', dark: '#d4b474' },
    accent: '#d4b474',
    accentBg: { light: 'rgba(212, 180, 116, 0.18)', dark: 'rgba(212, 180, 116, 0.18)' },
    tileBg: { light: '#f5eddc', dark: '#f5eddc' },
    radius: 18,
    overlay: { light: ['rgba(8,17,31,0.16)', 'rgba(8,17,31,1)'], dark: ['rgba(8,17,31,0.16)', 'rgba(8,17,31,1)'] }
  },

  // OTHER
  {
    id: 'polaroid',
    category: 'Other',
    label: 'Vintage Polaroid',
    desc: 'Classic photo frames',
    background: { light: '#f8f3e7', dark: '#1c1917' },
    panel: { light: '#fffaf0', dark: '#292524' },
    text: { light: '#1f2937', dark: '#f8f3e7' },
    muted: { light: '#78716c', dark: '#a8a29e' },
    accent: '#b45309',
    accentBg: { light: '#fef3c7', dark: 'rgba(180,83,9,0.2)' },
    tileBg: { light: '#ffffff', dark: '#292524' },
    radius: 2,
    overlay: { light: ['rgba(248,243,231,0.1)', 'rgba(248,243,231,1)'], dark: ['rgba(28,25,23,0.2)', 'rgba(28,25,23,1)'] }
  },
  {
    id: 'editorial',
    category: 'Other',
    label: 'Editorial Mag',
    desc: 'Magazine layout style',
    background: { light: '#fafaf9', dark: '#171717' },
    panel: { light: '#ffffff', dark: '#262626' },
    text: { light: '#111827', dark: '#fafaf9' },
    muted: { light: '#374151', dark: '#d1d5db' },
    accent: '#111827',
    accentBg: { light: '#f5f5f4', dark: 'rgba(255,255,255,0.1)' },
    tileBg: { light: '#e7e5e4', dark: '#262626' },
    radius: 0,
    overlay: { light: ['rgba(250,250,249,0.05)', 'rgba(250,250,249,1)'], dark: ['rgba(23,23,23,0.2)', 'rgba(23,23,23,1)'] }
  },
  {
    id: 'vibrant',
    category: 'Other',
    label: 'Vibrant Energy',
    desc: 'Colorful and dynamic',
    background: { light: '#f5f3ff', dark: '#4c1d95' },
    panel: { light: '#ffffff', dark: 'rgba(255,255,255,0.1)' },
    text: { light: '#4c1d95', dark: '#ffffff' },
    muted: { light: '#7c3aed', dark: '#ddd6fe' },
    accent: '#8b5cf6',
    accentBg: { light: '#ede9fe', dark: 'rgba(139,92,246,0.2)' },
    tileBg: { light: '#ffffff', dark: '#5b21b6' },
    radius: 15,
    overlay: { light: ['rgba(245,243,255,0.1)', 'rgba(245,243,255,1)'], dark: ['rgba(76,29,149,0.2)', 'rgba(76,29,149,1)'] }
  },
  {
    id: 'zen',
    category: 'Other',
    label: 'Zen Garden',
    desc: 'Calm and peaceful',
    background: { light: '#f5f5f4', dark: '#1c1917' },
    panel: { light: '#ffffff', dark: '#292524' },
    text: { light: '#44403c', dark: '#f5f5f4' },
    muted: { light: '#78716c', dark: '#a8a29e' },
    accent: '#57534e',
    accentBg: { light: '#e7e5e4', dark: 'rgba(87,83,78,0.2)' },
    tileBg: { light: '#ffffff', dark: '#292524' },
    radius: 100,
    overlay: { light: ['rgba(245,245,244,0.1)', 'rgba(245,245,244,1)'], dark: ['rgba(28,25,23,0.2)', 'rgba(28,25,23,1)'] }
  },
  // COLLEGE
  {
    id: 'cyber_tech',
    category: 'College',
    label: 'Cyber Tech',
    desc: 'Neon cyber hackathon & dark cyan agency layout',
    background: { light: '#08080a', dark: '#08080a' },
    panel: { light: '#131318', dark: '#131318' },
    text: { light: '#ffffff', dark: '#ffffff' },
    muted: { light: '#9ca3af', dark: '#9ca3af' },
    accent: '#3af0d8',
    accentBg: { light: 'rgba(58, 240, 216, 0.14)', dark: 'rgba(58, 240, 216, 0.18)' },
    tileBg: { light: '#131318', dark: '#131318' },
    radius: 12,
    overlay: { light: ['rgba(8,8,10,0.2)', 'rgba(8,8,10,1)'], dark: ['rgba(8,8,10,0.2)', 'rgba(8,8,10,1)'] }
  },
  {
    id: 'retro_arcade',
    category: 'College',
    label: 'Retro Arcade',
    desc: 'Vibrant golden yellow & sleek charcoal black contrast layout',
    background: { light: '#ffc200', dark: '#121212' },
    panel: { light: '#121212', dark: '#1e1e1e' },
    text: { light: '#121212', dark: '#ffffff' },
    muted: { light: '#4b5563', dark: '#9ca3af' },
    accent: '#ffc200',
    accentBg: { light: 'rgba(255, 194, 0, 0.18)', dark: 'rgba(255, 194, 0, 0.22)' },
    tileBg: { light: '#121212', dark: '#1a1a1a' },
    radius: 12,
    overlay: { light: ['rgba(255,194,0,0.2)', 'rgba(255,194,0,1)'], dark: ['rgba(18,18,18,0.2)', 'rgba(18,18,18,1)'] }
  },
  {
    id: 'academic_editorial',
    category: 'College',
    label: 'Academic Editorial',
    desc: 'Clean minimalist journal & campus registry style',
    background: { light: '#FCFAF7', dark: '#0B0E14' },
    panel: { light: '#FFFFFF', dark: '#161A23' },
    text: { light: '#1C1C1E', dark: '#F5F6F8' },
    muted: { light: '#636E72', dark: '#8E939E' },
    accent: '#800020',
    accentBg: { light: 'rgba(128, 0, 32, 0.08)', dark: 'rgba(229, 169, 59, 0.15)' },
    tileBg: { light: '#FFFFFF', dark: '#161A23' },
    radius: 2,
    overlay: { light: ['rgba(252,250,247,0.1)', 'rgba(252,250,247,1)'], dark: ['rgba(11,14,20,0.1)', 'rgba(11,14,20,1)'] },
    useSerif: true
  },
  {
    id: 'neon_carnival',
    category: 'College',
    label: 'Neon Carnival',
    desc: 'Glowing festival lights & concert stage',
    background: { light: '#0c0714', dark: '#06030a' },
    panel: { light: 'rgba(24, 15, 38, 0.72)', dark: 'rgba(15, 9, 24, 0.8)' },
    text: { light: '#faf5ff', dark: '#faf5ff' },
    muted: { light: '#d8b4fe', dark: '#a855f7' },
    accent: '#d946ef',
    accentBg: { light: 'rgba(217, 70, 239, 0.15)', dark: 'rgba(217, 70, 239, 0.2)' },
    tileBg: { light: '#140c21', dark: '#0b0612' },
    radius: 24,
    overlay: { light: ['rgba(12,7,20,0.15)', 'rgba(12,7,20,1)'], dark: ['rgba(6,3,10,0.15)', 'rgba(6,3,10,1)'] }
  },
];

export const getTemplateCategoryForEventCategory = (category?: string) => {
  if (category === 'Sports') return 'Other';
  return category || 'Wedding';
};

export const getTemplatesForEventCategory = (category?: string) => {
  const templateCategory = getTemplateCategoryForEventCategory(category);
  return MOBILE_TEMPLATE_THEMES.filter((theme) => theme.category === templateCategory);
};

export const getDefaultTemplateForEventCategory = (category?: string) => {
  const templates = getTemplatesForEventCategory(category);
  return templates[0] || MOBILE_TEMPLATE_THEMES[0];
};
