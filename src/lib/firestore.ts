import { db } from "./firebase";
import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp, addDoc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";

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
    createdAt?: any;
}

// --- Functions ---

/**
 * Fetches all events from the 'events' collection.
 */
export async function getEvents(): Promise<Event[]> {
    try {
        const eventsCol = collection(db, "events");
        const snapshot = await getDocs(eventsCol);
        return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Event));
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
export async function getEventPhotos(eventId: string, legacyId?: string): Promise<Photo[]> {
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
                const data = doc.data() as any;
                const rawDate = data.uploadedAt;
                let uploadedAt: number;

                if (rawDate?.toMillis) {
                    uploadedAt = rawDate.toMillis();
                } else if (rawDate?.seconds) {
                    uploadedAt = rawDate.seconds * 1000;
                } else if (typeof rawDate === 'number') {
                    uploadedAt = rawDate;
                } else {
                    uploadedAt = Date.now();
                }

                return { ...data, id: doc.id, uploadedAt };
            })
            .sort((a, b) => b.uploadedAt - a.uploadedAt);
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
 * Checks if a phone number is allow-listed and returns the user data.
 */
export async function getAllowedUser(phone: string): Promise<any | null> {
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
 * Logs a successful login to the guests collection.
 */
export async function logGuestLogin(name: string, phone: string) {
    try {
        const docRef = doc(db, "guests", phone);
        await setDoc(docRef, {
            name,
            phone,
            loginAt: Timestamp.now()
        }, { merge: true }); // Merge to update login time if they login again
    } catch (error) {
        console.error("Error logging guest login:", error);
    }
}

/**
 * Fetches all guest logs.
 */
export async function getGuestLogs(): Promise<any[]> {
    try {
        const guestsCol = collection(db, "guests");
        const q = query(guestsCol, orderBy("loginAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
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
export async function getPendingRequests(): Promise<any[]> {
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
export async function createUserProfile(uid: string, name: string, email: string, role: string = "user") {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        const existingData = docSnap.exists() ? docSnap.data() : {};

        // Sync logic: Keep existing role if it exists, otherwise use provided role
        await setDoc(docRef, {
            name,
            email,
            role: existingData.role || role,
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
export async function getUserProfile(uid: string) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
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
export async function getUsers(): Promise<any[]> {
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
 * Fetches events created by a specific user, optionally filtered by type.
 * Uses a broad fetch + client-side filter to be 100% resilient to legacy data & index building.
 */
export async function getUserEvents(userId: string, type?: 'main' | 'sub', parentId?: string, legacyParentId?: string): Promise<Event[]> {
    try {
        const eventsCol = collection(db, "events");
        const q = query(eventsCol, where("createdBy", "==", userId));
        const snapshot = await getDocs(q);
        let events = snapshot.docs.map(doc => {
            const data = doc.data() as any;
            const event = { ...data, id: doc.id } as Event;
            if (data.id && data.id !== doc.id) {
                event.legacyId = data.id;
            }
            return event;
        });

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

        // Sort by date (descending)
        return filteredEvents.sort((a, b) => {
            const dateA = a.date || "";
            const dateB = b.date || "";
            return dateB.localeCompare(dateA);
        });
    } catch (error: any) {
        console.error("Error fetching user events:", error);
        return [];
    }
}

/**
 * Fetches all sub-events for a given parent event ID with legacy support.
 */
export async function getSubEvents(parentId: string, legacyParentId?: string): Promise<Event[]> {
    try {
        const ids = legacyParentId && legacyParentId !== parentId ? [parentId, legacyParentId] : [parentId];
        const eventsCol = collection(db, "events");
        const q = query(
            eventsCol,
            where("parentId", "in", ids),
            orderBy("date", "desc")
        );
        const snapshot = await getDocs(q);

        // Map and filter out the parent itself to prevent circular display
        return snapshot.docs
            .map(doc => {
                const data = doc.data() as any;
                const event = { ...data, id: doc.id } as Event;
                if (data.id && data.id !== doc.id) {
                    event.legacyId = data.id;
                }
                return event;
            })
            .filter(e => e.id !== parentId && (!legacyParentId || e.id !== legacyParentId));
    } catch (error) {
        console.error("Error fetching sub-events:", error);
        return [];
    }
}

/**
 * Updates a user's role in Firestore.
 */
export async function updateUserRole(uid: string, newRole: string) {
    try {
        const docRef = doc(db, "users", uid);
        await updateDoc(docRef, { role: newRole });
        return true;
    } catch (error) {
        console.error("Error updating user role:", error);
        return false;
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
            if ((sanitizedEvent as any)[key] === undefined) {
                delete (sanitizedEvent as any)[key];
            }
        });

        await setDoc(docRef, {
            ...sanitizedEvent,
            createdAt: Timestamp.now()
        });
        return true;
    } catch (error: any) {
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
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log(`[Firestore] getEventById: Successfully found event by document ID: ${docSnap.id}`);
            const data = docSnap.data() as any;
            const event = { ...data, id: docSnap.id } as Event;
            if (data.id && data.id !== docSnap.id) {
                event.legacyId = data.id;
                console.log(`[Firestore] getEventById: Legacy ID detected: "${data.id}"`);
            }
            return event;
        }

        console.warn(`[Firestore] getEventById: No document found for ID: "${decodedId}". Attempting fallback search...`);

        // 2. Query Search (Backup for index/ID consistency issues)
        const eventsCol = collection(db, "events");
        const q = query(eventsCol, where("id", "==", decodedId));
        const querySnap = await getDocs(q);

        if (!querySnap.empty) {
            const firstDoc = querySnap.docs[0];
            console.log(`[Firestore] getEventById: Success through fallback search. ID: ${firstDoc.id}`);
            const data = firstDoc.data() as any;
            const event = { ...data, id: firstDoc.id } as Event;
            if (data.id && data.id !== firstDoc.id) {
                event.legacyId = data.id;
            }
            return event;
        }

        // 3. Scan Search (Last Resort - only if index is missing/building)
        console.warn(`[Firestore] getEventById: Fallback query empty. Performing collection scan as last resort...`);
        const allEvents = await getDocs(eventsCol);
        console.log(`[Firestore] getEventById: Last resort scan. Total docs: ${allEvents.size}. Searching for: "${decodedId}"`);

        // Literal match first
        let match = allEvents.docs.find(d => d.id === decodedId || (d.data() as any).id === decodedId);

        // Fuzzy match second (DIAGNOSTIC)
        if (!match && decodedId && decodedId.length >= 3) {
            match = allEvents.docs.find(d =>
                d.id.startsWith(decodedId) ||
                ((d.data() as any).id && (d.data() as any).id.startsWith(decodedId))
            );

            if (match) {
                console.warn(`[Firestore] getEventById: ⚠️ HYPER-FUZZY MATCH FOUND! Requested: "${decodedId}", Resolved to: "${match.id}". THIS INDICATES A TRUNCATION BUG UPSTREAM.`);
            }
        }

        if (match) {
            console.log(`[Firestore] getEventById: Found match. ID: ${match.id}`);
            const data = match.data() as any;
            const event = { ...data, id: match.id } as Event;
            if (data.id && data.id !== match.id) {
                event.legacyId = data.id;
            }
            return event;
        }

        console.error(`[Firestore][v2-fuzzy] getEventById: Event "${decodedId}" NOT FOUND after full fuzzy scan. Queried ID (JSON): ${JSON.stringify(decodedId)}. All DocIDs in DB: ${JSON.stringify(allEvents.docs.map(d => d.id))}`);
        return null;
    } catch (error: any) {
        console.error("[Firestore] getEventById Error:", error.message || error);
        return null;
    }
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
        // 1. Get event details to find potential legacyId
        const event = await getEventById(eventId);
        const ids = event?.legacyId && event.legacyId !== eventId ? [eventId, event.legacyId] : [eventId];

        // 2. Delete all photos associated with this event from Firestore
        const photosRef = collection(db, "photos");
        const q = query(photosRef, where("eventId", "in", ids));
        const photoSnaps = await getDocs(q);

        const deletePromises = photoSnaps.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        // 3. Delete the event itself
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

