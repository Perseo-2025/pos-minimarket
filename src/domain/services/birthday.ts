import { storeDateKey } from "../value-objects/store-time";

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// True when `dateKey` (YYYY-MM-DD, store day) is the birthday of someone born
// on `birthDate` (YYYY-MM-DD). Someone born on 29/02 celebrates on 28/02 in
// non-leap years.
export function isBirthdayOn(birthDate: string, dateKey: string) {
  const birthMonthDay = birthDate.slice(5, 10);
  const year = Number(dateKey.slice(0, 4));
  const monthDay = dateKey.slice(5, 10);
  if (birthMonthDay === "02-29" && !isLeapYear(year)) return monthDay === "02-28";
  return monthDay === birthMonthDay;
}

// Birthday checked on the store's calendar (Lima), not the device's zone.
export function isBirthdayAt(birthDate: string | null, at: Date) {
  return birthDate !== null && isBirthdayOn(birthDate, storeDateKey(at));
}

// Whole years old on the given store day.
export function ageOn(birthDate: string, dateKey: string) {
  const age = Number(dateKey.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return dateKey.slice(5, 10) < birthDate.slice(5, 10) ? age - 1 : age;
}

// The gift is offered once a year, on the birthday itself.
export function birthdayGiftAvailable(input: {
  birthDate: string | null;
  giftUsedThisYear: boolean;
  giftMaxAmount: number;
  at: Date;
}) {
  return (
    input.giftMaxAmount > 0 &&
    !input.giftUsedThisYear &&
    isBirthdayAt(input.birthDate, input.at)
  );
}
