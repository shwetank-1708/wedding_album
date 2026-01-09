"use client";

import { useRef } from "react";
import { motion, useInView, Variant } from "framer-motion";

interface ScrollRevealProps {
    children: React.ReactNode;
    width?: "fit-content" | "100%";
    className?: string;
    delay?: number;
    direction?: "up" | "down" | "left" | "right" | "none";
    duration?: number;
}

export const ScrollReveal = ({
    children,
    width = "100%",
    className = "",
    delay = 0,
    direction = "up",
    duration = 0.8
}: ScrollRevealProps) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-10%" });

    const getVariants = () => {
        const distance = 50;
        let initial = {};

        switch (direction) {
            case "up": initial = { y: distance, opacity: 0 }; break;
            case "down": initial = { y: -distance, opacity: 0 }; break;
            case "left": initial = { x: distance, opacity: 0 }; break;
            case "right": initial = { x: -distance, opacity: 0 }; break;
            case "none": initial = { opacity: 0 }; break;
        }

        return {
            hidden: initial,
            visible: {
                x: 0,
                y: 0,
                opacity: 1,
                transition: {
                    duration: duration,
                    // ease: "easeOut", // Removed to fix build error
                    delay: delay
                }
            }
        };
    };

    return (
        <div ref={ref} style={{ width, overflow: "hidden" }} className={className}>
            <motion.div
                variants={getVariants()}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
            >
                {children}
            </motion.div>
        </div>
    );
};
