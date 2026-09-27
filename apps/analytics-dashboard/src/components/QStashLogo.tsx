import React from 'react';

interface QStashLogoProps {
  className?: string;
  fill?: string;
}

export const QStashLogo: React.FC<QStashLogoProps> = ({
  className = 'h-4 w-auto',
  fill = '#00E9A3',
}) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Upstash / QStash lightning queue mark */}
    <rect width="100" height="100" rx="22" fill="#0b1b17" />
    <path
      d="M54.5 16L24 53.5H48L44 84L76 46.5H51.5L54.5 16Z"
      fill={fill}
    />
    <path
      d="M48 53.5L54.5 16L38 53.5H48Z"
      fill="#00B87A"
      opacity="0.6"
    />
  </svg>
);

export const QStashIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-auto' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M13.5 2L4 13H12L10 22L20 11H12.5L13.5 2Z"
      fill="#00E9A3"
      stroke="#00E9A3"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
