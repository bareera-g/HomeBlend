/**
 * HomeBlend Design Tokens
 * Warm luxury palette matching the web app, with Apple-premium refinements.
 */

export const B = {
  // Backgrounds
  bg: '#FFF2E1',
  bgWarm: '#F5EFE5',
  bgCard: 'rgba(255,255,255,0.92)',
  bgPanel: 'rgba(255,252,247,0.98)',
  bgInput: 'rgba(255,255,255,0.7)',

  // Text
  ink: '#2C1A0E',
  inkSoft: '#4A2E18',
  muted: '#A79277',
  mutedLight: '#C4B29E',

  // Accent
  gold: '#A67C3D',
  goldBg: 'rgba(166,124,61,0.08)',
  goldBorder: 'rgba(166,124,61,0.2)',

  // Semantic
  like: '#4A7C59',
  likeBg: 'rgba(74,124,89,0.09)',
  likeBorder: 'rgba(74,124,89,0.25)',
  pass: '#8B3A3A',
  passBg: 'rgba(139,58,58,0.09)',
  passBorder: 'rgba(139,58,58,0.25)',
  star: '#A67C3D',
  starBg: 'rgba(166,124,61,0.09)',
  error: '#C0624A',
  errorBg: 'rgba(192,98,74,0.08)',

  // Borders
  border: 'rgba(167,146,119,0.25)',
  borderLight: 'rgba(167,146,119,0.12)',

  // Overlay
  overlay: 'rgba(20,12,5,0.38)',
  scrim: 'rgba(12,5,2,0.6)',

  // White
  white: '#FFFFFF',
  offWhite: '#FAF6EE',
};

export const Shadows = {
  card: {
    shadowColor: 'rgba(80,50,10,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHover: {
    shadowColor: 'rgba(80,50,10,1)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 32,
    elevation: 8,
  },
  panel: {
    shadowColor: 'rgba(80,50,10,1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 48,
    elevation: 12,
  },
  avatar: {
    shadowColor: 'rgba(80,50,10,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  button: {
    shadowColor: 'rgba(80,50,10,1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
};

export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const AvatarColors = [
  '#A67C3D', '#4A7C59', '#7C4A59', '#4A5E7C',
  '#7C6A4A', '#4A7C7C', '#7C4A4A', '#5E7C4A',
];
