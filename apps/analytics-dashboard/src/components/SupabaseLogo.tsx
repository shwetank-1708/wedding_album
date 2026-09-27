import React from 'react';

interface SupabaseLogoProps {
  className?: string;
}

export const SupabaseLogo: React.FC<SupabaseLogoProps> = ({ className = 'h-5 w-auto' }) => (
  <svg
    viewBox="0 0 109 113"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M63.7076 110.284C60.848 113.885 55.0822 111.914 54.9811 107.314L53.9738 61.4965L99.914 61.4965C106.315 61.4965 109.966 68.7981 106.012 73.7779L63.7076 110.284Z"
      fill="url(#supabase_paint0_linear)"
    />
    <path
      d="M63.7076 110.284C60.848 113.885 55.0822 111.914 54.9811 107.314L53.9738 61.4965L99.914 61.4965C106.315 61.4965 109.966 68.7981 106.012 73.7779L63.7076 110.284Z"
      fill="black"
      fillOpacity="0.2"
    />
    <path
      d="M45.317 2.07541C48.1766 -1.52582 53.9424 0.445256 54.0435 5.04543L54.218 50.8631H9.10959C2.70881 50.8631 -0.942095 43.5615 3.01168 38.5817L45.317 2.07541Z"
      fill="#3ECF8E"
    />
    <defs>
      <linearGradient
        id="supabase_paint0_linear"
        x1="53.9738"
        y1="61.4965"
        x2="89.3789"
        y2="93.818"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#249361" />
        <stop offset="1" stopColor="#3ECF8E" />
      </linearGradient>
    </defs>
  </svg>
);
