import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strips all non-numeric characters from a string and returns the last 10 digits.
 */
export function sanitizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Formats a phone number string as (XXX) XXX-XXXX.
 */
export function formatPhoneNumber(value: string): string {
  const phoneNumber = value.replace(/\D/g, '').slice(0, 10);
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 1) return "";
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
}
