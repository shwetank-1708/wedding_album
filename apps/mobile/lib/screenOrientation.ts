import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeScreenOrientationModule = {
  lockAsync?: (orientationLock: number) => Promise<void>;
};

export const SCREEN_ORIENTATION_LOCK = {
  // These values match expo-screen-orientation's native OrientationLock enum.
  PORTRAIT_UP: 3,
  LANDSCAPE: 5,
} as const;

const nativeScreenOrientation =
  Platform.OS === 'web'
    ? null
    : requireOptionalNativeModule<NativeScreenOrientationModule>('ExpoScreenOrientation');

export function canLockScreenOrientation() {
  return typeof nativeScreenOrientation?.lockAsync === 'function';
}

export async function lockScreenOrientation(orientationLock: number) {
  if (!nativeScreenOrientation?.lockAsync) {
    return false;
  }

  try {
    await nativeScreenOrientation.lockAsync(orientationLock);
    return true;
  } catch (error) {
    console.error('[ScreenOrientation] Orientation lock failed:', error);
    return false;
  }
}
