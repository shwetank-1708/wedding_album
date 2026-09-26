import React from 'react';

interface RazorpayLogoProps {
  className?: string;
  fill?: string;
}

export const RazorpayLogo: React.FC<RazorpayLogoProps> = ({
  className = 'h-4 w-auto',
  fill = '#0C83FD',
}) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect width="120" height="120" rx="26" fill="#061226" />
    <path
      d="M48.8 24L26 96H44.5L56.5 58.5L78.2 46.2L85 24H48.8Z"
      fill={fill}
    />
    <path
      d="M59.2 59.8L51 96H69.5L81.2 59.8H59.2Z"
      fill="#38BDF8"
    />
    <path
      d="M72 46.2L63.5 73.2L86 60.5L94 34L72 46.2Z"
      fill="#0284C7"
      opacity="0.85"
    />
  </svg>
);

export const RazorpayIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-auto' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M9.76 4.8L5.2 19.2H8.9L11.3 11.7L15.64 9.24L17 4.8H9.76Z"
      fill="#0C83FD"
    />
    <path
      d="M11.84 11.96L10.2 19.2H13.9L16.24 11.96H11.84Z"
      fill="#38BDF8"
    />
  </svg>
);
