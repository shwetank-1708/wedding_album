// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'photo.fill': 'photo-library',
  'photo': 'photo',
  'person.fill': 'person',
  'line.3.horizontal': 'menu',
  'heart.fill': 'favorite',
  'heart': 'favorite-border',
  'bubble.left.fill': 'chat-bubble',
  'bubble.right': 'chat-bubble-outline',
  'xmark': 'close',
  'star.fill': 'star',
  'star': 'star-border',
  'checkmark': 'check',
  'checkmark.circle.fill': 'check-circle',
  'exclamationmark.triangle.fill': 'warning',
  'info.circle': 'info',
  'person.2.fill': 'people',
  'camera.fill': 'photo-camera',
  'camera': 'camera-alt',
  'phone.fill': 'phone',
  'envelope.fill': 'mail',
  'clock.fill': 'schedule',
  'ellipsis': 'more-horiz',
  'plus': 'add',
  'photo.on.rectangle': 'collections',
  'shield.fill': 'shield',
  'rectangle.portrait.and.arrow.right': 'logout',
  'folder': 'folder',
  'calendar': 'event',
  'square.grid.2x2.fill': 'apps',
  'gearshape.fill': 'settings',
  'speaker.wave.2.fill': 'volume-up',
  'speaker.slash.fill': 'volume-off',
  'arrow.up.left.and.arrow.down.right': 'fullscreen',
  'arrow.down.right.and.arrow.up.left': 'fullscreen-exit',
  'pencil': 'edit',
  'trash.fill': 'delete',
  'trophy.fill': 'emoji-events',
  'gift.fill': 'card-giftcard',
  'sparkles': 'auto-awesome',
  'briefcase.fill': 'business-center',
  'lock.fill': 'lock',
  'theatermasks.fill': 'theater-comedy',
  'checkmark.seal.fill': 'verified',
  'paintbrush.fill': 'brush',
  'globe': 'public',
  'square.and.arrow.up': 'share',
  'chart.bar.fill': 'assessment',
  'cloud.fill': 'cloud',
  'calendar.fill': 'event',
  'sparkles.fill': 'auto-awesome',
  'creditcard.fill': 'credit-card',
  'message.fill': 'message',
  'questionmark.circle.fill': 'help-outline',
  'crown.fill': 'workspace-premium',
  'magnifyingglass': 'search',
  'bell.fill': 'notifications',
  'bell': 'notifications',
  'bell.slash.fill': 'notifications-off',
  'leaf.fill': 'eco',
  'eye.fill': 'visibility',
  'chevron.down': 'keyboard-arrow-down',
  'chevron.up': 'keyboard-arrow-up',
  'doc.on.doc.fill': 'content-copy',
  'graduationcap.fill': 'school',
  'figure.run': 'directions-run',
  'ellipsis.circle.fill': 'more-horiz',
  'tag.fill': 'local-offer',
  'bookmark': 'bookmark-border',
  'quote.opening': 'format-quote',
  'megaphone.fill': 'campaign',
  'photo.on.rectangle.angled': 'collections',
  'eye.slash.fill': 'visibility-off',
  'xmark.circle.fill': 'cancel',
  'plus.circle.fill': 'add-circle',
  'arrow.up.right': 'arrow-outward',
  'arrow.down.right': 'south-east',
  'arrow.down.to.line.compact': 'file-download',
  'arrow.counterclockwise': 'rotate-left',
  'arrow.clockwise': 'rotate-right',
  'minus': 'remove',
  'heart.circle.fill': 'favorite',
  'mappin.and.ellipse': 'location-on',
  'mappin.fill': 'location-on',
  'location.fill': 'my-location',
  'calendar.badge.plus': 'event',
  'arrow.right': 'arrow-forward',
  'qrcode.viewfinder': 'qr-code-scanner',
  'moon.fill': 'nights-stay',
  'sun.max.fill': 'wb-sunny',
  'play.fill': 'play-arrow',
  'play.rectangle.fill': 'smart-display',
  'video.fill': 'videocam',
  'fork.knife': 'restaurant',
  'tshirt.fill': 'checkroom',
  'pause.fill': 'pause',
  'backward.end.fill': 'skip-previous',
  'forward.end.fill': 'skip-next',
  'backward.fill': 'fast-rewind',
  'forward.fill': 'fast-forward',
} as const;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
