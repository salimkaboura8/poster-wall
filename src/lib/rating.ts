/**
 * Poster size for a 0.5–5 rating. Geometric, so every half star is the same visible step
 * (~14% bigger): ½★ → 0.56×, 3★ → 1.07×, 5★ → 1.8× the base width.
 */
const MIN = 0.56;
const MAX = 1.8;
export const ratingScale = (rating: number) => MIN * (MAX / MIN) ** ((rating - 0.5) / 4.5);

/** Unrated films sit below every rated size except ½★, so they never pass for favourites. */
export const UNRATED_SCALE = 0.62;

/** 3.5 → "★★★½" */
export const stars = (rating: number) => '★'.repeat(Math.floor(rating)) + (rating % 1 ? '½' : '');
