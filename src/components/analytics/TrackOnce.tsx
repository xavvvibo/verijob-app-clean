"use client";

import { useEffect, useRef } from "react";

export default function TrackOnce({
  onTrack,
}: {
  onTrack: () => void | Promise<void>;
}) {
  const did = useRef(false);

  useEffect(() => {
    if (did.current) return;
    did.current = true;
    void onTrack();
  }, [onTrack]);

  return null;
}
