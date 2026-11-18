import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Track an element's layout size (unaffected by CSS transforms). Uses a
 * callback ref so it starts observing when the element actually mounts — video
 * layers render nothing until a device is selected.
 */
export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
    const observerRef = useRef<ResizeObserver | null>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    const ref = useCallback((element: T | null) => {
        observerRef.current?.disconnect();
        observerRef.current = null;

        if (!element) return;

        const update = () => {
            setSize({ width: element.clientWidth, height: element.clientHeight });
        };

        update();

        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(update);
        observer.observe(element);
        observerRef.current = observer;
    }, []);

    useEffect(() => {
        return () => {
            observerRef.current?.disconnect();
            observerRef.current = null;
        };
    }, []);

    return [ref, size] as const;
}
