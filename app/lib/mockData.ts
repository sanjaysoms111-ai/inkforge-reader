import { Comic, Genre } from "./types";

// No built-in story comics.
// This reader is intended to display comics published from the inkforg_apexpanel
// Creator App (via the localStorage bridge at "inkforg_apexpanel_published_comics")
// and any content the user has published locally.
//
// Keeping MOCK_COMICS as an empty array ensures a clean starting state.
// All discovery, trending, latest, and "My Unlocked" sections gracefully
// degrade when only real creator/user content is present.

export const MOCK_COMICS: Comic[] = [];

export const GENRES: Genre[] = [
  "Fantasy", "Romance", "Action", "Mystery", "Sci-Fi", "Horror", "Comedy", "Drama", "Thriller", "Slice of Life",
];

// Legacy constants retained only for compatibility with any external references.
// Not used by the current UI or context logic.
export const TRENDING_IDS: string[] = [];
export const LATEST_IDS: string[] = [];
