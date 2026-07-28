import { getBoundedPageFlipIndex } from "./pageFlipNavigation";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(`${message}. Expected ${expected}, received ${actual}`);
}

const images = ["cover", "ceremony", "reception"];
let currentIndex = 0;

currentIndex = getBoundedPageFlipIndex(currentIndex, images.length, "next");
assertEqual(images[currentIndex], "ceremony", "right-side click/page flip advances to the next media");

currentIndex = getBoundedPageFlipIndex(currentIndex, images.length, "prev");
assertEqual(images[currentIndex], "cover", "left-side click/page flip returns to previous media");

