import { db } from "./firebase";
import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp, addDoc, setDoc, deleteDoc } from "firebase/firestore";

// --- Types ---

export interface Event {
    id: string; // "haldi", "wedding", etc.
    title: string;
    date: string;
    coverImage: string;
    description: string;
}

export interface Photo {
    id: string;
    eventId: string;
    cloudinaryPublicId: string; // The ID in Cloudinary (e.g., "wed_album/mehendi/IMG_1234")
    url: string;                // The public URL (Cloudinary secure_url)
    driveDownloadUrl?: string;  // The direct download link from Drive (optional/fallback)
    height?: number;            // Important for Next.js Image optimization & CLS prevention
    width?: number;
    uploadedAt: Timestamp;
    tags?: string[];
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
