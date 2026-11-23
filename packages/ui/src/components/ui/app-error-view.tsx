'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { classifyError } from '@repo/errors';
import { Button } from './button';
import { Spinner } from './spinner';
import { StatusView } from './status-view';

/**
 * The ONE server-component error boundary view, shared by every app.
 *
 * Next.js requires an `error.tsx` per app/route-segment (must be a Client
 * Component), but each of those is a 3-line shim that renders this:
 *
 *   'use client';
 *   import { AppErrorView } from '@repo/ui/components/ui/app-error-view';
 *   export default function Error(props) { return <AppErrorView {...props} />; }
 *
 * Behavior:
 *   - Classifies the thrown error via @repo/errors (single source of truth).
 *   - For a transient/`network` error: shows "Reconnecting..." over the plug scene
 *     and AUTO-RETRIES ONCE (compute is usually warm by then, so the user often
 *     never sees this). NEVER prints the raw message (it can contain SQL).
 *   - For anything else: "Something went wrong" with the safe message, over the plug scene (status-view.tsx).
 *   - Shows `error.digest` as a copyable "Error ID" for support.
 */
export function AppErrorView({
    error,
    reset,
    title,
}: {
    error: Error & { digest?: string };
    reset: () => void;
    /** Optional override for the non-transient heading (e.g. "This page failed"). */
    title?: string;
}) {
    // classifyError may re-throw Next control-flow; guard so the boundary itself
    // never crashes while rendering.
    let transient = false;
    let safeMessage = 'An unexpected error occurred. Please try again.';
    try {
        const c = classifyError(error);
        transient = c.kind === 'network';
        safeMessage = c.userMessage;
    } catch {
        // Not our concern to classify - fall back to generic copy.
    }

    const [retrying, setRetrying] = useState(transient);
    const autoRetried = useRef(false);

    useEffect(() => {
        console.error('[AppErrorView]', error);
    }, [error]);

    // One automatic retry for transient errors - a warm compute usually answers
    // the second time, so the user never even sees this screen.
    useEffect(() => {
        if (!transient || autoRetried.current) return;
        autoRetried.current = true;
        const t = setTimeout(() => reset(), 1200);
        return () => clearTimeout(t);
    }, [transient, reset]);

    const handleRetry = () => {
        setRetrying(true);
        reset();
    };

    // The plug eases back into its socket (status-view.tsx) - inside the
    // shell, so not full screen. A transient blip says "Reconnecting" and retries once by itself.
    return (
        <StatusView
            kind="error"
            fullScreen={false}
            title={transient ? 'Reconnecting...' : (title ?? 'Something went wrong')}
            description={transient
                ? 'We had trouble reaching the server for a moment. This usually clears up on its own - retrying now.'
                : safeMessage}
            digest={error.digest}
            actions={(
                <Button variant="outline" onClick={handleRetry} disabled={retrying} className="h-10 gap-2 rounded-xl">
                    {retrying ? <Spinner className="size-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    {retrying ? 'Retrying...' : 'Try again'}
                </Button>
            )}
        />
    );
}
