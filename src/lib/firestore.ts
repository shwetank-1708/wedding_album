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
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Event));
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
            return { id: docSnap.id, ...docSnap.data() } as Event;
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
 * Fetches photos for a specific event.
 */
export async function getEventPhotos(eventId: string): Promise<Photo[]> {
    try {
        const photosCol = collection(db, "photos");
        const q = query(
            photosCol,
            where("eventId", "==", eventId)
            // orderBy("uploadedAt", "desc") // Commented out to debug missing index
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Photo));
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
export async function createUserProfile(uid: string, name: string, email: string) {
    try {
        const docRef = doc(db, "users", uid);
        await setDoc(docRef, {
            name,
            email,
            role: "user",
            createdAt: Timestamp.now(),
            lastLogin: Timestamp.now()
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error creating user profile:", error);
        return false;
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
 * Creates a new event in the 'events' collection.
 */
export async function createEvent(event: Event) {
    try {
        const docRef = doc(db, "events", event.id);
        await setDoc(docRef, {
            ...event,
            createdAt: Timestamp.now()
        });
        return true;
    } catch (error) {
        console.error("Error creating event:", error);
        return false;
    }
}

/**
 * Fetches a single event by ID with fallback support.
 */
export async function getEventById(eventId: string): Promise<Event | null> {
    console.log(`[Firestore] getEventById initiated for eventId: "${eventId}"`);
    try {
        if (!db) {
            console.error("[Firestore] getEventById: Firestore DB instance is not available.");
            return null;
        }

        // 1. Point Read (Most efficient)
        const docRef = doc(db, "events", eventId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log(`[Firestore] getEventById: Successfully found event by document ID: ${docSnap.id}`);
            return { id: docSnap.id, ...docSnap.data() } as Event;
        }

        console.warn(`[Firestore] getEventById: No document found for ID: "${eventId}". Attempting fallback search...`);

        // 2. Query Search (Backup for index/ID consistency issues)
        const eventsCol = collection(db, "events");
        const q = query(eventsCol, where("id", "==", eventId));
        const querySnap = await getDocs(q);

        if (!querySnap.empty) {
            const firstDoc = querySnap.docs[0];
            console.log(`[Firestore] getEventById: Success through fallback search. ID: ${firstDoc.id}`);
            return { id: firstDoc.id, ...firstDoc.data() } as Event;
        }

        // 3. Scan Search (Last Resort - only if index is missing/building)
        console.warn(`[Firestore] getEventById: Fallback query empty. Performing collection scan as last resort...`);
        const allEvents = await getDocs(eventsCol);
        const match = allEvents.docs.find(d => d.id === eventId || (d.data() as any).id === eventId);

        if (match) {
            console.log(`[Firestore] getEventById: Found via collection scan. ID: ${match.id}`);
            return { id: match.id, ...match.data() } as Event;
        }

        console.error(`[Firestore] getEventById: Event "${eventId}" not found after all attempts.`);
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
        // 1. Delete all photos associated with this event from Firestore
        const photosRef = collection(db, "photos");
        const q = query(photosRef, where("eventId", "==", eventId));
        const photoSnaps = await getDocs(q);

        const deletePromises = photoSnaps.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        // 2. Delete the event itself
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
 * Fetches events created by a specific user.
 */
export async function getUserEvents(userId: string): Promise<Event[]> {
    try {
        const eventsCol = collection(db, "events");
        const q = query(eventsCol, where("createdBy", "==", userId), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
    } catch (error: any) {
        if (error.code === 'failed-precondition' || error.message.includes('index')) {
            console.warn("[Firestore] Query index is still building. Using temporary client-side filtering.");
        } else {
            console.error("Error fetching user events:", error);
        }
        // Fallback or retry logic if index is missing
        const snapshot = await getDocs(collection(db, "events"));
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Event))
            .filter(e => e.createdBy === userId);
    }
}
