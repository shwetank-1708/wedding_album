import { supabase } from "./supabase";

export type NotificationPreferenceType = 'likesAndComments' | 'eventInvites' | 'businessMatches' | 'marketing';

function formatPushError(error: unknown) {
  if (!error) return "Unknown error";
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      code: record.code,
      message: record.message,
      details: record.details,
      hint: record.hint,
    };
  }
  return String(error);
}

/**
 * Sends a push notification to a specific user via their registered Expo Push Token.
 * 
 * @param recipientId The user ID of the recipient
 * @param title Title of the push notification
 * @param body Body of the push notification
 * @param data Optional payload data object
 * @param preferenceType Optional category to check against the user's notification preferences
 */
export async function sendPushNotification(
  recipientId: string,
  title: string,
  body: string,
  data?: object,
  preferenceType?: NotificationPreferenceType
): Promise<boolean> {
  if (!recipientId) return false;

  try {
    // 1. Fetch user's push token and notification preferences from Supabase profiles
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token, notification_preferences')
      .eq('id', recipientId)
      .maybeSingle();

    if (error) {
      console.warn(`[PushNotifications] Could not fetch push profile for recipient ${recipientId}. Skipping push.`, formatPushError(error));
      return false;
    }

    if (!profile || !profile.push_token) {
      console.log(`[PushNotifications] Recipient ${recipientId} has no registered push token. Skipping push.`);
      return false;
    }

    // 2. If a preference category is specified, verify that the user has not disabled it
    if (preferenceType && profile.notification_preferences) {
      const prefs = typeof profile.notification_preferences === 'string'
        ? JSON.parse(profile.notification_preferences)
        : profile.notification_preferences;

      if (prefs && prefs[preferenceType] === false) {
        console.log(`[PushNotifications] User ${recipientId} disabled notifications for category: ${preferenceType}. Skipping push.`);
        return false;
      }
    }

    // 3. Dispatch HTTP request to Expo's Push API
    console.log(`[PushNotifications] Dispatching push to ${recipientId} (${profile.push_token}): "${title}"`);
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: profile.push_token,
        sound: 'default',
        title,
        body,
        data: data || {},
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[PushNotifications] Expo API failed with status ${response.status}:`, errText);
      return false;
    }

    const resJson = await response.json();
    if (resJson.errors) {
      console.error('[PushNotifications] Expo reported errors in delivery:', resJson.errors);
      return false;
    }

    console.log('[PushNotifications] Push notification successfully delivered to Expo service.');
    return true;
  } catch (err) {
    console.error(`[PushNotifications] Critical error sending push to ${recipientId}:`, err);
    return false;
  }
}
