/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TMDB_READ_TOKEN?: string;
  readonly VITE_TMDB_API_KEY?: string;
  readonly VITE_LETTERBOXD_PROXY?: string;
  readonly VITE_TMDB_PROXY?: string;
}
