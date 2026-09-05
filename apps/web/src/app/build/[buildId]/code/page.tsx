/**
 * /build/[buildId]/code — Full-page code viewer for a build.
 *
 * Shows the generated source files in an IDE-style layout
 * with a file tree sidebar and tabbed code editor.
 */
'use client';

import { useParams } from 'next/navigation';
import { CodeViewer } from '@/components/CodeViewer';

export default function CodePage() {
  const { buildId } = useParams<{ buildId: string }>();

  return (
    <div
      style={{
        height: 'calc(100vh - 5rem)',
        border: '1px solid #e5e5e5',
        borderRadius: '0.75rem',
        overflow: 'hidden',
      }}
    >
      <CodeViewer buildId={buildId} />
    </div>
  );
}
