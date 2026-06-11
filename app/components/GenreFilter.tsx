"use client";

import { Genre } from "../lib/types";
import { GENRES } from "../lib/mockData";

interface Props {
  selected: Genre[];
  onToggle: (genre: Genre) => void;
  onClear: () => void;
}

export function GenreFilter({ selected, onToggle, onClear }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onClear}
        className={`genre-pill cursor-pointer ${selected.length === 0 ? "active bg-zinc-700 text-white" : ""}`}
      >
        All
      </button>
      {GENRES.map((genre) => {
        const active = selected.includes(genre);
        return (
          <button
            key={genre}
            onClick={() => onToggle(genre)}
            className={`genre-pill cursor-pointer ${active ? "active !bg-rose-600 !text-white" : ""}`}
          >
            {genre}
          </button>
        );
      })}
    </div>
  );
}
