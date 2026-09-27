import React from 'react';

interface RailwayLogoProps {
  className?: string;
  fill?: string;
}

export const RailwayLogo: React.FC<RailwayLogoProps> = ({
  className = 'h-5 w-auto',
  fill = 'currentColor',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M.03 14.526a6.837 6.837 0 0 1 2.37-3.09l9.364-6.494a4.103 4.103 0 0 1 4.778.077l6.818 5.127a6.838 6.838 0 0 1 2.64 5.38H.03Zm23.94 1.708a6.84 6.84 0 0 1-2.64 5.38l-6.818 5.127a4.103 4.103 0 0 1-4.778.077L.37 20.324A6.838 6.838 0 0 1 0 17.234h23.97v-1Z"
      fill={fill}
    />
  </svg>
);
