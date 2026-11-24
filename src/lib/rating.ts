/** Poster size for a 0.5–5 rating: ½★ → 0.68×, 5★ → 1.52× the base width (linear). */
export const ratingScale = (rating: number) => 0.68 + ((rating - 0.5) / 4.5) * 0.84;

/** 3.5 → "★★★½" */
export const stars = (rating: number) => '★'.repeat(Math.floor(rating)) + (rating % 1 ? '½' : '');
