import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { MidnightColors } from '../constants/theme';

const { width, height } = Dimensions.get('window');
const GOLD = MidnightColors.gold;
const GOLD_DIM = 'rgba(202,156,104,0.25)';
const MAROON = 'rgba(89,76,61,0.7)';
const BG = MidnightColors.background;

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = 'Capturing the moment' }: LoadingScreenProps) {
  // Spinning rings
  const spinOuter = useRef(new Animated.Value(0)).current;
  const spinMid = useRef(new Animated.Value(0)).current;
  const spinInner = useRef(new Animated.Value(0)).current;

  // Center glow pulse
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Brand + text fade-in
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  // Shimmer
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Animated dots
  const [dots, setDots] = useState('.');

  useEffect(() => {
    // Spinning rings
    Animated.loop(
      Animated.timing(spinOuter, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(spinMid, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(spinInner, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Brand fade-in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // Shimmer loop
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Dots animation
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '.' : prev + '.'));
    }, 500);

    return () => clearInterval(dotInterval);
  }, []);

  const rotateCW = spinOuter.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const rotateCCW = spinMid.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });
  const rotateInner = spinInner.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowSize = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 38],
  });
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const shimmerX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  return (
    <View style={styles.container}>
      {/* Ambient blobs */}
      <View style={styles.blobTopLeft} />
      <View style={styles.blobBottomRight} />

      {/* Spinner assembly */}
      <View style={styles.spinnerWrap}>
        {/* Outer ring CW */}
        <Animated.View style={[styles.ring, styles.ringOuter, { transform: [{ rotate: rotateCW }] }]}>
          <View style={styles.ringOuterArc} />
        </Animated.View>

        {/* Middle ring CCW */}
        <Animated.View style={[styles.ring, styles.ringMid, { transform: [{ rotate: rotateCCW }] }]}>
          <View style={styles.ringMidArc} />
        </Animated.View>

        {/* Inner ring CW */}
        <Animated.View style={[styles.ring, styles.ringInner, { transform: [{ rotate: rotateInner }] }]}>
          <View style={styles.ringInnerArc} />
        </Animated.View>

        {/* Glow shadow behind center */}
        <Animated.View
          style={[
            styles.glowCircle,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: 40,
              opacity: glowOpacity,
            },
          ]}
        />

        {/* Center gold aperture */}
        <View style={styles.centerDot}>
          {/* Inner dark hole */}
          <View style={styles.aperture}>
            {/* Glint */}
            <View style={styles.glint} />
          </View>
        </View>
      </View>

      {/* Brand + text */}
      <Animated.View
        style={[
          styles.brandWrap,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.brandRow}>
          <Text style={styles.brandText}>EveBash</Text>
        </View>

        <Text style={styles.messageText}>
          {message}
          <Text style={{ opacity: 0.7 }}>{dots}</Text>
        </Text>

        {/* Shimmer bar */}
        <View style={styles.shimmerBar}>
          <Animated.View
            style={[
              styles.shimmerFill,
              { transform: [{ translateX: shimmerX }] },
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const RING_OUTER = 120;
const RING_MID = 92;
const RING_INNER = 64;
const CENTER = 44;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // Blobs
  blobTopLeft: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(202,156,104,0.08)',
  },
  blobBottomRight: {
    position: 'absolute',
    bottom: -60,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(89,76,61,0.16)',
  },

  // Spinner wrap
  spinnerWrap: {
    width: RING_OUTER,
    height: RING_OUTER,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  // Rings — positioned absolutely, centered
  ring: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    width: RING_OUTER,
    height: RING_OUTER,
    borderRadius: RING_OUTER / 2,
    borderWidth: 2,
    borderColor: GOLD_DIM,
    borderTopColor: GOLD,
    borderRightColor: 'rgba(202,156,104,0.55)',
  },
  ringOuterArc: { width: 0, height: 0 }, // just a spacer

  ringMid: {
    width: RING_MID,
    height: RING_MID,
    borderRadius: RING_MID / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(93,0,30,0.1)',
    borderBottomColor: MAROON,
    borderLeftColor: 'rgba(93,0,30,0.4)',
  },
  ringMidArc: { width: 0, height: 0 },

  ringInner: {
    width: RING_INNER,
    height: RING_INNER,
    borderRadius: RING_INNER / 2,
    borderWidth: 1,
    borderColor: 'rgba(202,156,104,0.06)',
    borderTopColor: 'rgba(202,156,104,0.65)',
  },
  ringInnerArc: { width: 0, height: 0 },

  // Glow
  glowCircle: {
    position: 'absolute',
    backgroundColor: GOLD,
    alignSelf: 'center',
  },

  // Center aperture
  centerDot: {
    position: 'absolute',
    width: CENTER,
    height: CENTER,
    borderRadius: CENTER / 2,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  aperture: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: 'rgba(202,156,104,0.3)',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 3,
  },
  glint: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  // Brand
  brandWrap: {
    marginTop: 32,
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandText: {
    fontFamily: 'AkayaKanadaka_400Regular',
    fontSize: 28,
    color: GOLD,
    letterSpacing: 2,
    lineHeight: 30,
    textShadowColor: 'rgba(202,156,104,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  brandAmp: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 14,
    color: 'rgba(202,156,104,0.4)',
    marginBottom: 2,
  },
  messageText: {
    marginTop: 4,
    fontFamily: 'Outfit_400Regular',
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(255,247,235,0.56)',
    textAlign: 'center',
  },

  // Shimmer bar
  shimmerBar: {
    marginTop: 20,
    width: 110,
    height: 2,
    backgroundColor: 'rgba(202,156,104,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  shimmerFill: {
    width: '40%',
    height: '100%',
    backgroundColor: GOLD,
    opacity: 0.7,
    borderRadius: 2,
  },
});
