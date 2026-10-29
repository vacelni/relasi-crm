'use client';

import { useState } from 'react';

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }}
      className="text-xs font-medium text-primary hover:underline"
    >
      {copied ? 'Link copied' : 'Copy invite link'}
    </button>
  );
}
