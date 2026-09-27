"use client";

import { useEffect, useState } from "react";

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = "Capturing the moment" }: LoadingScreenProps) {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0d0808 0%, #180a0a 40%, #0a150f 100%)",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow blobs */}
      <div style={{
        position: "absolute",
        top: -80, left: -80,
        width: 300, height: 300,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        bottom: -60, right: -60,
        width: 260, height: 260,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(93,0,30,0.16) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Spinner stack */}
      <div style={{ position: "relative", width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Outer ring */}
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "2px solid rgba(212,175,55,0.12)",
          borderTopColor: "#CA9C68",
          borderRightColor: "rgba(212,175,55,0.5)",
          animation: "ls-cw 1.8s linear infinite",
        }} />
        {/* Middle ring */}
        <div style={{
          position: "absolute",
          inset: 14,
          borderRadius: "50%",
          border: "1.5px solid rgba(93,0,30,0.12)",
          borderBottomColor: "rgba(93,0,30,0.8)",
          borderLeftColor: "rgba(93,0,30,0.4)",
          animation: "ls-ccw 2.8s linear infinite",
        }} />
        {/* Inner ring */}
        <div style={{
          position: "absolute",
          inset: 28,
          borderRadius: "50%",
          border: "1px solid rgba(212,175,55,0.08)",
          borderTopColor: "rgba(212,175,55,0.6)",
          animation: "ls-cw 1.2s linear infinite",
        }} />

        {/* Center: glowing aperture */}
        <div style={{
          position: "relative",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "radial-gradient(circle at 36% 36%, #F0DEAA 0%, #CA9C68 50%, #6b4c0e 100%)",
          boxShadow: "0 0 20px 6px rgba(212,175,55,0.35)",
          animation: "ls-pulse 2.2s ease-in-out infinite",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}>
          {/* Dark aperture hole */}
          <div style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#0d0808",
            border: "1px solid rgba(212,175,55,0.3)",
            position: "relative",
          }}>
            {/* Glint */}
            <div style={{
              position: "absolute",
              top: 3, left: 4,
              width: 5, height: 5,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.22)",
            }} />
          </div>
        </div>
      </div>

      {/* Brand name */}
      <div style={{
        marginTop: 32,
        display: "flex",
        alignItems: "baseline",
        gap: 7,
        fontFamily: "var(--font-inter), Helvetica, Arial, sans-serif",
        animation: "ls-fadeup 0.8s ease-out 0.15s both",
      }}>
        <span style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "#CA9C68",
          textShadow: "0 0 24px rgba(212,175,55,0.5)",
        }}>EveBash</span>
      </div>

      {/* Message */}
      <p style={{
        marginTop: 10,
        fontFamily: "var(--font-inter), Helvetica, Arial, sans-serif",
        fontSize: "0.68rem",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "rgba(255,253,208,0.45)",
        animation: "ls-fadeup 0.8s ease-out 0.3s both",
        textAlign: "center",
        minWidth: 200,
      }}>
        {message}
        <span style={{ display: "inline-block", width: 18, textAlign: "left" }}>{dots}</span>
      </p>

      {/* Shimmer bar */}
      <div style={{
        marginTop: 20,
        width: 110,
        height: 2,
        background: "rgba(212,175,55,0.1)",
        borderRadius: 2,
        overflow: "hidden",
        animation: "ls-fadeup 0.8s ease-out 0.45s both",
      }}>
        <div style={{
          height: "100%",
          width: "40%",
          background: "linear-gradient(90deg, transparent, #CA9C68, transparent)",
          animation: "ls-shimmer 1.6s ease-in-out infinite",
        }} />
      </div>

      {/* Falling petals */}
      {[
        { left: "8%",  dur: "9s",   del: "0s"    },
        { left: "21%", dur: "11s",  del: "-3s"   },
        { left: "35%", dur: "8s",   del: "-5.5s" },
        { left: "50%", dur: "12s",  del: "-1.5s" },
        { left: "63%", dur: "9.5s", del: "-7s"   },
        { left: "76%", dur: "10s",  del: "-2.5s" },
        { left: "88%", dur: "8.5s", del: "-4s"   },
      ].map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.left,
            width: 8,
            height: 15,
            borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
            background: "linear-gradient(160deg, #F0DEAA, #CA9C68)",
            opacity: 0,
            animation: `ls-petal ${p.dur} linear infinite`,
            animationDelay: p.del,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Keyframes injected inline */}
      <style>{`
        @keyframes ls-cw    { to { transform: rotate(360deg);  } }
        @keyframes ls-ccw   { to { transform: rotate(-360deg); } }
        @keyframes ls-pulse {
          0%,100% { box-shadow: 0 0 20px 6px rgba(212,175,55,0.35); }
          50%     { box-shadow: 0 0 36px 12px rgba(212,175,55,0.65); }
        }
        @keyframes ls-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(260%);  }
        }
        @keyframes ls-fadeup {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes ls-petal {
          0%   { top: -5%;  opacity: 0;    transform: rotate(0deg)   translateX(0);    }
          10%  {             opacity: 0.7; }
          90%  {             opacity: 0.3; }
          100% { top: 108%; opacity: 0;    transform: rotate(300deg) translateX(25px); }
        }
      `}</style>
    </div>
  );
}
