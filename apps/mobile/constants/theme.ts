/**
 * Below are the colors that are used in the app.
 */

import { Platform } from 'react-native';

const tintColorDark = '#CA9C68';

export const Colors = {
  light: {
    text: '#FFF7EB',
    background: '#13191F',
    tint: tintColorDark,
    icon: '#CDB89E',
    tabIconDefault: '#CDB89E',
    tabIconSelected: tintColorDark,
  },
  dark: {
    text: '#FFF7EB',
    background: '#13191F',
    tint: tintColorDark,
    icon: '#CDB89E',
    tabIconDefault: '#CDB89E',
    tabIconSelected: tintColorDark,
  },
};

export const MidnightColors = {
  background: '#13191F',
  deepSlate: '#1B211F',
  slate900: '#1B211F',
  slate800: '#2B2F2E',
  slate700: '#594C3D',
  slate400: '#CDB89E',
  gold: '#CA9C68',
  white: '#FFF7EB',
  ghostWhite: '#FFF7EB',
  border: 'rgba(202, 156, 104, 0.25)',
  cardBorder: 'rgba(202, 156, 104, 0.12)',
};

export const RoyalColors = {
  maroon: '#594C3D',
  gold: '#CA9C68',
  cream: '#FFF7EB',
  green: '#2B2F2E',
  slate800: '#2B2F2E',
  slate700: '#594C3D',
  slate400: '#CDB89E',
};

export const Fonts = {
  ...Platform.select({
    ios: {
      sans: 'Inter_400Regular',
      serif: 'Inter_400Regular',
    },
    default: {
      sans: 'Inter_400Regular',
      serif: 'Inter_400Regular',
    },
  }),
  playfair: {
    regular: 'Inter_400Regular',
    italic: 'Inter_400Regular',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  cormorant: {
    regular: 'Inter_400Regular',
    italic: 'Inter_400Regular',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  lora: {
    regular: 'Inter_400Regular',
    italic: 'Inter_400Regular',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  nunitoSans: {
    regular: 'Inter_400Regular',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  outfit: {
    regular: 'Inter_400Regular',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    extraBold: 'Inter_800ExtraBold',
  },
  inter: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    extraBold: 'Inter_800ExtraBold',
    black: 'Inter_900Black',
  },
  spaceGrotesk: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  monofett: {
    regular: 'Inter_400Regular',
  },
  bubblegum: {
    regular: 'Inter_400Regular',
  },
  permanentMarker: {
    regular: 'Inter_400Regular',
  },
  vt323: {
    regular: 'Inter_400Regular',
  },
  syne: {
    bold: 'Inter_700Bold',
  },
  yellowtail: {
    regular: 'Inter_400Regular',
  },
  alexBrush: {
    regular: 'Inter_400Regular',
  },
  cookie: {
    regular: 'Inter_400Regular',
  },
  grandHotel: {
    regular: 'Inter_400Regular',
  },
  cinzelDecorative: {
    regular: 'Inter_400Regular',
    bold: 'Inter_700Bold',
  },
  cinzel: {
    regular: 'Inter_400Regular',
    bold: 'Inter_700Bold',
  }
};
