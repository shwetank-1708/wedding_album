import { db } from "./firebase";
import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp, addDoc, setDoc, deleteDoc, updateDoc, deleteField, onSnapshot, DocumentData, QueryDocumentSnapshot, DocumentSnapshot } from "firebase/firestore";

// --- Types ---

export interface Event {
    id: string; // "haldi", "wedding", etc.
    title: string;
    date: string;
    coverImage: string;
    description: string;
    createdBy?: string; // UID of the user who created it
    type?: 'main' | 'sub';
    parentId?: string;
    legacyId?: string; // Captures original truncated/mismatched ID for backward compatibility
    templateId?: string; // 'hero' | 'classic', defaults to 'hero'
}

export interface Photo {
    id: string;
    eventId: string;
    cloudinaryPublicId: string; // The ID in Cloudinary (or Firebase path)
    url: string;                // The public URL
    driveDownloadUrl?: string;  // Fallback
    height?: number;
    width?: number;
    uploadedAt: Timestamp;
    tags?: string[];
    userId?: string;            // UID of the owner
    size?: number;              // File size in bytes
    format?: string;            // e.g., 'jpg', 'png'
}

export interface FaceRecord {
    id?: string;
    imageId: string;
    descriptor: number[]; // The 128-float vector
    eventId: string;
    imageUrl: string;
    width: number;
    height: number;
    createdAt?: Timestamp;
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
    roleType?: 'primary' | 'event';
    delegatedBy?: string;
    assignedEvents?: string[];
    createdAt?: Timestamp;
    lastLogin?: Timestamp;
}

export interface GuestLog {
    id: string;
    name: string;
    phone: string;
    eventId?: string;
    parentEventId?: string;
    parentEventOwnerId?: string;
    eventTitle?: string;
    loginAt?: Timestamp;
    status: 'pending' | 'approved' | 'rejected';
}

// --- Functions ---

/**
 * Fetches all events from the 'events' collection.
 */
export async function getEvents(): Promise<Event[]> {
    try {
        const eventsCol = collection(db, "events");
        const snapshot = await getDocs(eventsCol);
        return snapshot.docs
            .map((doc) => ({ ...doc.data(), id: doc.id } as Event))
            .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } catch (error) {
        console.error("Error fetching events:", error);
        return [];
    }
}

/**
 * Fetches a single event by its ID (slug).
 */
export async function getEvent(id: string): Promise<Event | null> {
    try {
        const docRef = doc(db, "events", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { ...docSnap.data(), id: docSnap.id } as Event;
        } else {
            console.log("No such event!");
            return null;
        }
    } catch (error) {
        console.error("Error fetching event:", error);
        return null;
    }
}

/**
 * Fetches photos for a specific event with legacy ID support.
 */
// --- Helper for serialization ---
function sanitizeData(data: DocumentData): DocumentData {
    if (!data) return data;
    const sanitized = { ...data };

    // Convert common Firestore Timestamp fields to millis or string
    ['createdAt', 'updatedAt', 'date', 'uploadedAt', 'lastLogin'].forEach(field => {
        if (sanitized[field] && typeof sanitized[field].toMillis === 'function') {
            sanitized[field] = sanitized[field].toMillis();
        } else if (sanitized[field] && typeof sanitized[field] === 'object' && sanitized[field].seconds) {
            sanitized[field] = sanitized[field].seconds * 1000;
        }
    });

    return sanitized;
}

export async function getEventPhotos(eventId: string, legacyId?: string): Promise<Photo[]> {
    if (!eventId) {
        console.warn("[Firestore] getEventPhotos: eventId is missing.");
        return [];
    }
    try {
        const ids = legacyId && legacyId !== eventId ? [eventId, legacyId] : [eventId];
        const photosCol = collection(db, "photos");
        const q = query(
            photosCol,
            where("eventId", "in", ids)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map((doc) => {
                const data = sanitizeData(doc.data());
                return { ...data, id: doc.id } as Photo;
            })
            .sort((a, b) => ((b.uploadedAt as unknown as number) || 0) - ((a.uploadedAt as unknown as number) || 0));
    } catch (error) {
        console.error("Error fetching photos:", error);
        return [];
    }
}

/**
 * Saves a detected face descriptor to the 'faces' collection.
 */
export async function saveFaceToIndex(face: FaceRecord) {
    try {
        const facesCol = collection(db, "faces");
        await addDoc(facesCol, {
            ...face,
            createdAt: Timestamp.now()
        });
        return true;
    } catch (error) {
        console.error("Error saving face to index:", error);
        return false;
    }
}

/**
 * Saves photo metadata to 'photos' collection.
 */
export async function savePhoto(photo: Photo) {
    try {
        const docRef = doc(db, "photos", photo.id); // Use the ID we generate
        await setDoc(docRef, {
            ...photo
        });
        return true;
    } catch (error) {
        console.error("Error saving photo:", error);
        return false;
    }
}

/**
 * Fetches all face descriptors from the 'faces' collection.
 * Used by the client to compare against the selfie.
 */
export async function getAllFaceEncodings(): Promise<FaceRecord[]> {
    try {
        const facesCol = collection(db, "faces");
        // We might want to limit this eventually, but for < 10,000 faces it's fine
        const snapshot = await getDocs(facesCol);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as FaceRecord));
    } catch (error) {
        console.error("Error fetching face index:", error);
        return [];
    }
}

/**
 * Fetches face descriptors for a specific event (and its legacy ID).
 */
export async function getEventFaceEncodings(eventIds: string | string[], legacyIds?: string[]): Promise<FaceRecord[]> {
    try {
        const ids = Array.isArray(eventIds) ? eventIds : [eventIds];
        if (legacyIds) ids.push(...legacyIds);

        // Firestore 'in' query supports max 10/30 items. 
        // We assume we won't exceed this for a single wedding (usually < 10 events)
        const facesCol = collection(db, "faces");
        const q = query(facesCol, where("eventId", "in", ids));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as FaceRecord));
    } catch (error) {
        console.error("Error fetching event face index:", error);
        return [];
    }
}

/**
 * Checks if a phone number is allow-listed and returns the user data.
 */
export async function getAllowedUser(phone: string): Promise<DocumentData | null> {
    try {
        const docRef = doc(db, "allowed_users", phone);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error("Error checking allowed user:", error);
        return null;
    }
}

/**
 * Logs a successful login or event access to the guests collection.
 */
export async function logGuestLogin(name: string, phone: string, eventId?: string, parentEventId?: string, eventTitle?: string, ownerId?: string) {
    try {
        // We use a combined ID if eventId is provided to track multiple event accesses per person
        const logId = eventId ? `${phone}_${eventId}` : phone;
        const docRef = doc(db, "guests", logId);

        await setDoc(docRef, {
            name,
            phone,
            eventId: eventId || null,
            parentEventId: parentEventId || null,
            parentEventOwnerId: ownerId || null,
            eventTitle: eventTitle || "General Access",
            loginAt: Timestamp.now(),
            status: 'pending' // Default to pending for approval workflow
        }, { merge: true });
    } catch (error) {
        console.error("Error logging guest login:", error);
    }
}

/**
 * Updates the status of a guest request (e.g., approved, rejected).
 */
export async function updateGuestStatus(logId: string, status: 'pending' | 'approved' | 'rejected') {
    try {
        const docRef = doc(db, "guests", logId);
        await updateDoc(docRef, { status });
        return true;
    } catch (error) {
        console.error("Error updating guest status:", error);
        return false;
    }
}

/**
 * Listens for changes in a guest's status.
 */
export function onGuestStatusChange(logId: string, callback: (status: string) => void) {

    const docRef = doc(db, "guests", logId);
    return onSnapshot(docRef, (doc: DocumentSnapshot<DocumentData>) => {
        if (doc.exists()) {
            const data = doc.data();
            if (data) callback(data.status);
        }
    });
}

/**
 * Fetches guest logs for a specific event or parent event.
 */
export async function getEventLogs(eventId: string): Promise<GuestLog[]> {
    if (!eventId) {
        console.warn("[Firestore] getEventLogs: eventId is missing.");
        return [];
    }
    try {
        const guestsCol = collection(db, "guests");
        const q = query(
            guestsCol,
            where("parentEventId", "==", eventId),
            orderBy("loginAt", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GuestLog));
    } catch {
        // Fallback if index is missing or eventId check
        const guestsCol = collection(db, "guests");
        const q = query(guestsCol, orderBy("loginAt", "desc"));
        const snapshot = await getDocs(q);
        const allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GuestLog));
        return allLogs.filter((log: GuestLog) => log.eventId === eventId || log.parentEventId === eventId);
    }
}

/**
 * Fetches guest logs, optionally filtered by ownerId(s).
 */
export async function getGuestLogs(ownerIds?: string | string[]): Promise<GuestLog[]> {
    try {
        const guestsCol = collection(db, "guests");
        let q;
        if (ownerIds) {
            const ids = Array.isArray(ownerIds) ? ownerIds.filter(Boolean) : [ownerIds].filter(Boolean);
            if (ids.length > 0) {
                q = query(
                    guestsCol,
                    where("parentEventOwnerId", "in", ids),
                    orderBy("loginAt", "desc")
                );
            } else {
                q = query(guestsCol, orderBy("loginAt", "desc"));
            }
        } else {
            q = query(guestsCol, orderBy("loginAt", "desc"));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GuestLog));
    } catch (error: unknown) {
        // Fallback for missing index: fetch all and filter in-memory
        const err = error as Error;
        if (err.message?.includes("index")) {
            console.warn("[Firestore] getGuestLogs: Index missing. Falling back to in-memory filter.");
            try {
                const guestsCol = collection(db, "guests");
                const snapshot = await getDocs(guestsCol);
                let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GuestLog));

                if (ownerIds) {
                    const ids = Array.isArray(ownerIds) ? ownerIds.filter(Boolean) : [ownerIds].filter(Boolean);
                    if (ids.length > 0) {
                        logs = logs.filter(log => log.parentEventOwnerId && ids.includes(log.parentEventOwnerId));
                    }
                }

                // Sort in-memory
                return logs.sort((a, b) => {
                    const timeA = a.loginAt?.toMillis?.() || 0;
                    const timeB = b.loginAt?.toMillis?.() || 0;
                    return timeB - timeA;
                });
            } catch (fallbackError) {
                console.error("Critical error in getGuestLogs fallback:", fallbackError);
                return [];
            }
        }
        console.error("Error fetching guest logs:", error);
        return [];
    }
}

/**
 * Adds a user to the allowed_users collection.
 * This is for admin/seeding purposes.
 */
export async function addAllowedUser(name: string, phone: string, role: string = "guest") {
    try {
        const docRef = doc(db, "allowed_users", phone);
        await setDoc(docRef, {
            name,
            phone,
            role,
            addedAt: Timestamp.now()
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error adding allowed user:", error);
        return false;
    }
}

/**
 * Creates a request for access in the pending_requests collection.
 */
export async function requestAccess(name: string, phone: string) {
    try {
        const docRef = doc(db, "pending_requests", phone);
        await setDoc(docRef, {
            name,
            phone,
            requestedAt: Timestamp.now()
        });
        return true;
    } catch (error) {
        console.error("Error requesting access:", error);
        return false;
    }
}

/**
 * Fetches all pending requests.
 */
export async function getPendingRequests(): Promise<DocumentData[]> {
    try {
        const reqCol = collection(db, "pending_requests");
        const q = query(reqCol, orderBy("requestedAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching pending requests:", error);
        return [];
    }
}

/**
 * Denies (deletes) a pending request.
 */
export async function denyRequest(phone: string) {
    try {
        const docRef = doc(db, "pending_requests", phone);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error("Error denying request:", error);
        return false;
    }
}
/**
 * Creates or updates a user profile in the 'users' collection.
 */
export async function createUserProfile(uid: string, name: string, email: string, role: string = "guest") {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        const existingData = docSnap.exists() ? docSnap.data() : {};

        // Sync logic: Keep existing role if it exists, otherwise use provided role
        await setDoc(docRef, {
            name,
            email,
            role: existingData.role || role,
            roleType: existingData.roleType || (existingData.delegatedBy ? 'event' : 'primary'),
            createdAt: existingData.createdAt || Timestamp.now(),
            lastLogin: Timestamp.now()
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error creating user profile:", error);
        return false;
    }
}

/**
 * Fetches a user profile from Firestore by UID.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as UserProfile;
        }
        return null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

/**
 * Fetches all registered users from the 'users' collection.
 */
export async function getUsers(): Promise<DocumentData[]> {
    try {
        const usersCol = collection(db, "users");
        const q = query(usersCol, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
}

/**
 * Fetches events created by a specific user or group of identifiers, optionally filtered by type.
 * Uses a broad fetch + client-side filter to be 100% resilient to legacy data & index building.
 */
export async function getUserEvents(userIds: string | string[], type?: 'main' | 'sub', parentId?: string, legacyParentId?: string): Promise<Event[]> {
    const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds].filter(Boolean);

    if (ids.length === 0) {
        console.warn("[Firestore] getUserEvents: userIds are missing.");
        return [];
    }

    try {
        const eventsCol = collection(db, "events");
        const q = query(eventsCol, where("createdBy", "in", ids));
        const snapshot = await getDocs(q);
        const events = snapshot.docs.map(doc => {
            const data = doc.data();
            const event = { ...data, id: doc.id } as Event;
            if (data.id && data.id !== doc.id) {
                event.legacyId = data.id;
            }
            return event;
        });
        // ...

        // perform filtering client-side for maximum resilience
        let filteredEvents = [...events];

        if (type === 'sub') {
            filteredEvents = filteredEvents.filter(e => {
                const isMatch = e.parentId === parentId || (legacyParentId && e.parentId === legacyParentId);
                const isNotSelf = e.id !== parentId && (!legacyParentId || e.id !== legacyParentId);
                const isSubLevel = e.type === 'sub' || (!!e.parentId);
                return isMatch && isNotSelf && isSubLevel;
            });
        } else {
            // Main collections: include explicit 'main' type OR legacy events (no type AND no parent)
            filteredEvents = filteredEvents.filter(e => {
                const isMain = e.type === 'main' || (!e.type && !e.parentId);
                if (!isMain) {
                    // Check if parent actually exists in the user's event list
                    const parentExists = events.some(ev => ev.id === e.parentId);
                    if (!parentExists) {
                        return true;
                    }
                }
                return isMain;
            });
        }

        // Sort by title alphabetically
        return filteredEvents.sort((a, b) => {
            const titleA = a.title || "";
            const titleB = b.title || "";
            return titleA.localeCompare(titleB);
        });
    } catch (error: unknown) {
        console.error("Error fetching user events:", error);
        return [];
    }
}

/**
 * Fetches all sub-events for a given parent event ID with legacy support.
 */
export async function getSubEvents(parentId: string, legacyParentId?: string): Promise<Event[]> {
    if (!parentId) {
        console.warn("[Firestore] getSubEvents: parentId is missing.");
        return [];
    }
    try {
        const ids = legacyParentId && legacyParentId !== parentId ? [parentId, legacyParentId] : [parentId];
        const eventsCol = collection(db, "events");
        const q = query(
            eventsCol,
            where("parentId", "in", ids)
        );
        const snapshot = await getDocs(q);

        // Map and filter out the parent itself to prevent circular display
        const subEvents = snapshot.docs
            .map(doc => {
                const data = doc.data() as DocumentData;
                const event = { ...data, id: doc.id } as Event;
                if (data.id && data.id !== doc.id) {
                    event.legacyId = data.id;
                }
                return event;
            })
            .filter(e => e.id !== parentId && (!legacyParentId || e.id !== legacyParentId));

        // Sort by title alphabetically
        return subEvents.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } catch (error) {
        console.error("Error fetching sub-events:", error);
        return [];
    }
}

/**
 * Updates a user's role in Firestore, tracking who Delegated the role.
 */
export async function updateUserRole(uid: string, newRole: string, delegatedBy?: string, roleType?: 'primary' | 'event', assignedEvents?: string[]) {
    if (!uid) {
        console.warn("[Firestore] updateUserRole: uid is missing.");
        return false;
    }
    try {
        const docRef = doc(db, "users", uid);
        const updateData: Record<string, unknown> = { role: newRole };

        if (newRole === "admin") {
            if (delegatedBy) updateData.delegatedBy = delegatedBy;
            if (roleType) updateData.roleType = roleType;
            if (assignedEvents) updateData.assignedEvents = assignedEvents;
        } else {
            // Cleanup on demotion
            updateData.delegatedBy = deleteField();
            updateData.roleType = deleteField();
            updateData.assignedEvents = deleteField();
        }

        await updateDoc(docRef, updateData);
        return true;
    } catch (error) {
        console.error("Error updating user role:", error);
        return false;
    }
}

/**
 * Counts how many people a specific user has promoted to 'admin' or 'editor'.
 */
export async function getDelegatedAdminsCount(ownerUid: string): Promise<number> {
    if (!ownerUid) {
        console.warn("[Firestore] getDelegatedAdminsCount: ownerUid is missing.");
        return 0;
    }
    try {
        const usersCol = collection(db, "users");
        const q = query(usersCol, where("delegatedBy", "==", ownerUid));
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error("Error counting delegated admins:", error);
        return 0;
    }
}

/**
 * Deletes a user profile from Firestore.
 */
export async function deleteUser(uid: string) {
    try {
        const docRef = doc(db, "users", uid);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error("Error deleting user:", error);
        return false;
    }
}
/**
 * Creates a new event in the 'events' collection.
 */
export async function createEvent(event: Event) {
    try {
        const docRef = doc(db, "events", event.id);

        // Sanitize: remove any undefined fields that Firestore doesn't like
        const sanitizedEvent = { ...event };
        Object.keys(sanitizedEvent).forEach(key => {
            if ((sanitizedEvent as Record<string, unknown>)[key] === undefined) {
                delete (sanitizedEvent as Record<string, unknown>)[key];
            }
        });

        await setDoc(docRef, {
            ...sanitizedEvent,
            createdAt: Timestamp.now()
        });
        return true;
    } catch (error: unknown) {
        console.error("Error creating event:", error);
        throw error;
    }
}

/**
 * Fetches a single event by ID with fallback support.
 */
export async function getEventById(eventId: string): Promise<Event | null> {
    const decodedId = decodeURIComponent(eventId);
    console.log(`[Firestore] getEventById initiated for: "${eventId}" (decoded: "${decodedId}")`);
    try {
        if (!db) {
            console.error("[Firestore] getEventById: Firestore DB instance is not available.");
            return null;
        }

        // 1. Point Read (Most efficient)
        const docRef = doc(db, "events", decodedId);
        console.log(`[Firestore] getEventById: Attempting point read for "${decodedId}"...`);
        let docSnap;
        try {
            docSnap = await getDoc(docRef);
            console.log(`[Firestore] getEventById: Point read completed. Exists: ${docSnap.exists()}`);
        } catch (e: unknown) {
            const err = e as Error;
            console.error(`[Firestore] getEventById: Point read FAILED for "${decodedId}". Permission error likely here:`, err.message || err);
            throw e; // Reraise to be caught by the outer catch
        }

        if (docSnap.exists()) {
            console.log(`[Firestore] getEventById: Successfully found event by document ID: ${docSnap.id}`);
            const data = docSnap.data() as DocumentData;
            const event = { ...data, id: docSnap.id } as Event;
            if (data.id && data.id !== docSnap.id) {
                event.legacyId = data.id;
                console.log(`[Firestore] getEventById: Legacy ID detected: "${data.id}"`);
            }
            return event;
        }


        console.warn(`[Firestore] getEventById: No document found via point read for ID: "${decodedId}". Attempting fallback query...`);

        // 2. Query Search (Backup for index/ID consistency issues)
        const eventsCol = collection(db, "events");
        // Check 'id' field, 'legacyId' field, and 'title' field (as a last resort for slugs)
        // Note: Firestore doesn't support logical OR in a single query easily without 'or' query which requires newer SDK/indexes.
        // We will run them in parallel or sequence. Sequence is safer for preference.

        // Strategy A: Check 'id' == decodedId (Legacy behavior)
        const qId = query(eventsCol, where("id", "==", decodedId));
        const snapId = await getDocs(qId);
        if (!snapId.empty) return mapDocToEvent(snapId.docs[0]);

        // Strategy B: Check 'legacyId' == decodedId
        const qLegacy = query(eventsCol, where("legacyId", "==", decodedId));
        const snapLegacy = await getDocs(qLegacy);
        if (!snapLegacy.empty) {
            console.log(`[Firestore] getEventById: Found via legacyId: "${decodedId}"`);
            return mapDocToEvent(snapLegacy.docs[0]);
        }

        // Strategy C: Check 'title' == decodedId (Fallback for when title is used as slug)
        const qTitle = query(eventsCol, where("title", "==", decodedId));
        const snapTitle = await getDocs(qTitle);
        if (!snapTitle.empty) {
            console.log(`[Firestore] getEventById: Found via title: "${decodedId}"`);
            return mapDocToEvent(snapTitle.docs[0]);
        }

        console.warn(`[Firestore] getEventById: No document found for ID/Legacy/Title: "${decodedId}"`);
        return null;
    } catch (error: unknown) {
        const err = error as Error;
        console.error("[Firestore] getEventById Error:", err.message || err);
        return null;
    }
}

function mapDocToEvent(docSnapshot: QueryDocumentSnapshot<DocumentData>): Event {
    const data = docSnapshot.data();
    const event = { ...data, id: docSnapshot.id } as Event;
    if (data.id && data.id !== docSnapshot.id) {
        event.legacyId = data.id;
    }
    return event;
}


/**
 * Deletes a specific photo record from Firestore.
 */
export async function deletePhoto(photoId: string): Promise<boolean> {
    try {
        await deleteDoc(doc(db, "photos", photoId));
        return true;
    } catch (error) {
        console.error("Error deleting photo:", error);
        return false;
    }
}

/**
 * Deletes an event and all its associated photos from Firestore.
 */
export async function deleteEvent(eventId: string): Promise<boolean> {
    try {
        console.log(`[Firestore] deleteEvent initiated for: "${eventId}"`);

        // 1. Find and delete all sub-events recursively
        const eventsRef = collection(db, "events");
        const subSnap = await getDocs(query(eventsRef, where("parentId", "==", eventId)));

        if (!subSnap.empty) {
            console.log(`[Firestore] Found ${subSnap.size} sub-events for "${eventId}". Deleting recursively...`);
            for (const subDoc of subSnap.docs) {
                await deleteEvent(subDoc.id);
            }
        }

        // 2. Get event details to find potential legacyId
        const event = await getEventById(eventId);
        const ids = event?.legacyId && event.legacyId !== eventId ? [eventId, event.legacyId] : [eventId];

        // 3. Delete all photos associated with this specific event from Firestore
        const photosRef = collection(db, "photos");
        const q = query(photosRef, where("eventId", "in", ids));
        const photoSnaps = await getDocs(q);

        if (!photoSnaps.empty) {
            const deletePromises = photoSnaps.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
        }

        // 4. Delete the event itself
        await deleteDoc(doc(db, "events", eventId));
        return true;
    } catch (error) {
        console.error("Error deleting event:", error);
        return false;
    }
}

/**
 * Updates an event's data in Firestore.
 */
export async function updateEvent(eventId: string, data: Partial<Event>): Promise<boolean> {
    try {
        const eventRef = doc(db, "events", eventId);
        await updateDoc(eventRef, data);
        return true;
    } catch (error) {
        console.error("Error updating event:", error);
        return false;
    }
}

/**
 * Calculates the total size of all photos uploaded by a specific user.
 */
export async function getUserTotalStorage(userId: string): Promise<number> {
    try {
        const photosCol = collection(db, "photos");
        const q = query(photosCol, where("userId", "==", userId));
        const snapshot = await getDocs(q);

        let totalSize = 0;
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            totalSize += (data.size || 0);
        });

        return totalSize;
    } catch (error) {
        console.error("Error calculating total storage:", error);
        return 0;
    }
}

/**
 * Serializes Firestore data by converting Timestamps to ISO strings.
 * This is necessary for passing data from Server Components to Client Components.
 */
export function serializeFirestoreData<T>(data: T): T {
    if (data === null || data === undefined) {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(item => serializeFirestoreData(item)) as unknown as T;
    }

    if (typeof data === 'object') {
        const newData: any = {};
        for (const key in data) {
            const value = (data as any)[key];
            if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
                // It's a Firestore Timestamp (or similar) - convert to ISO string
                // We check for toDate() method which standard Firebase Timestamps have
                if (typeof value.toDate === 'function') {
                    newData[key] = value.toDate().toISOString();
                } else {
                    // Fallback if it's just a plain object with seconds (unlikely from SDK but possible)
                    newData[key] = new Date(value.seconds * 1000).toISOString();
                }
            } else {
                newData[key] = serializeFirestoreData(value);
            }
        }
        return newData as T;
    }

    return data;
}

