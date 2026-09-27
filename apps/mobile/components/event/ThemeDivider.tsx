import React from 'react';
import { View, Text } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface ThemeDividerProps {
  selectedTemplate: any;
  styles: any;
}

export function ThemeDivider({ selectedTemplate, styles }: ThemeDividerProps) {
  if (selectedTemplate.id === 'royal') {
    return (
      <View style={styles.royalDividerContainer}>
        <View style={[styles.royalDividerLine, { backgroundColor: selectedTemplate.accent }]} />
        <Text style={[styles.royalDividerDiamond, { color: selectedTemplate.accent }]}>♦</Text>
        <View style={[styles.royalDividerLine, { backgroundColor: selectedTemplate.accent }]} />
      </View>
    );
  }
  if (selectedTemplate.id === 'classic') {
    return (
      <View style={styles.classicDividerContainer}>
        <View style={[styles.classicDividerLine, { backgroundColor: selectedTemplate.accent ? `${selectedTemplate.accent}40` : 'rgba(139, 154, 110, 0.25)' }]} />
        <Text style={[styles.classicDividerDot, { color: selectedTemplate.accent || '#8B9A6E' }]}>✦</Text>
        <View style={[styles.classicDividerLine, { backgroundColor: selectedTemplate.accent ? `${selectedTemplate.accent}40` : 'rgba(139, 154, 110, 0.25)' }]} />
      </View>
    );
  }
  if (selectedTemplate.id === 'hero') {
    return (
      <View style={styles.heroDividerContainer}>
        <View style={[styles.heroDividerLine, { backgroundColor: 'rgba(204, 164, 59, 0.25)' }]} />
        <Text style={[styles.heroDividerStar, { color: '#cca43b' }]}>✦</Text>
        <View style={[styles.heroDividerLine, { backgroundColor: 'rgba(204, 164, 59, 0.25)' }]} />
      </View>
    );
  }
  if (selectedTemplate.id === 'ethereal') {
    return (
      <View style={styles.etherealDividerContainer}>
        <View style={[styles.etherealDividerLine, { backgroundColor: selectedTemplate.accent + '4d' }]} />
        <Text style={[styles.etherealDividerAsterisk, { color: selectedTemplate.accent, fontFamily: selectedTemplate.serifFont }]}>❦</Text>
        <View style={[styles.etherealDividerLine, { backgroundColor: selectedTemplate.accent + '4d' }]} />
      </View>
    );
  }
  if (selectedTemplate.id === 'academic_editorial') {
    return (
      <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
        <View style={{ height: 1, backgroundColor: selectedTemplate.text, opacity: 0.12 }} />
      </View>
    );
  }
  if (selectedTemplate.id === 'garden') {
    return (
      <View style={styles.gardenDividerContainer}>
        <View style={[styles.gardenDividerLine, { backgroundColor: 'rgba(22, 163, 74, 0.15)' }]} />
        <IconSymbol name="leaf.fill" size={14} color="#16a34a" />
        <View style={[styles.gardenDividerLine, { backgroundColor: 'rgba(22, 163, 74, 0.15)' }]} />
      </View>
    );
  }
  if (selectedTemplate.id === 'bohemian') {
    return (
      <View style={styles.bohemianDividerContainer}>
        <View style={[styles.bohemianGuitarString, { backgroundColor: selectedTemplate.text + '12', height: 1, marginBottom: 2 }]} />
        <View style={[styles.bohemianGuitarString, { backgroundColor: selectedTemplate.text + '25', height: 1 }]} />
      </View>
    );
  }
  return null;
}
