import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './ROIModal.css';

export interface ROI {
    x: number; // percentage 0-100 of video dimensions
    y: number; // percentage 0-100 of video dimensions
    width: number; // percentage 0-100 of video dimensions
    height: number; // percentage 0-100 of video dimensions
}

interface ROIModalProps {
    deviceId: string;
    initialROI?: ROI;
    onSave: (roi: ROI) => void;
    onCancel: () => void;
}

export default function ROIModal({ deviceId, initialROI, onSave, onCancel }: ROIModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [roi, setRoi] = useState<ROI>(initialROI || { x: 10, y: 10, width: 80, height: 80 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState<{ x: number; y: number; roiX: number; roiY: number } | null>(null);
    const [resizeStart, setResizeStart] = useState<{ x: number; y: number; roi: ROI } | null>(null);
    const [videoBounds, setVideoBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

    // Setup video stream
    useEffect(() => {
        let currentStream: MediaStream | null = null;

        const setupVideoStream = async () => {
            if (!deviceId) return;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: { exact: deviceId }
                    },
                    audio: false
                });

                currentStream = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (error) {
                console.error('Error accessing video device:', error);
            }
        };

        setupVideoStream();

        return () => {
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
            if (videoRef.current) {
                const oldStream = videoRef.current.srcObject as MediaStream;
                if (oldStream) {
                    oldStream.getTracks().forEach(track => track.stop());
                }
                videoRef.current.srcObject = null;
            }
        };
    }, [deviceId]);

    // Calculate video bounds (accounting for object-fit: contain)
    useEffect(() => {
        const updateVideoBounds = () => {
            if (!videoRef.current || !containerRef.current) return;

            const video = videoRef.current;
            const container = containerRef.current;

            // Wait for video metadata to load
            if (video.videoWidth === 0 || video.videoHeight === 0) return;

            const containerRect = container.getBoundingClientRect();
            const videoAspect = video.videoWidth / video.videoHeight;
            const containerAspect = containerRect.width / containerRect.height;

            let videoDisplayWidth, videoDisplayHeight, videoX, videoY;

            if (containerAspect > videoAspect) {
                // Container is wider - video constrained by height
                videoDisplayHeight = containerRect.height;
                videoDisplayWidth = videoDisplayHeight * videoAspect;
                videoX = (containerRect.width - videoDisplayWidth) / 2;
                videoY = 0;
            } else {
                // Container is taller - video constrained by width
                videoDisplayWidth = containerRect.width;
                videoDisplayHeight = videoDisplayWidth / videoAspect;
                videoX = 0;
                videoY = (containerRect.height - videoDisplayHeight) / 2;
            }

            setVideoBounds({
                x: videoX,
                y: videoY,
                width: videoDisplayWidth,
                height: videoDisplayHeight
            });
        };

        // Update on video load
        const video = videoRef.current;
        if (video) {
            video.addEventListener('loadedmetadata', updateVideoBounds);
            // Also try immediately in case it's already loaded
            updateVideoBounds();
        }

        // Update on window resize
        window.addEventListener('resize', updateVideoBounds);

        return () => {
            if (video) {
                video.removeEventListener('loadedmetadata', updateVideoBounds);
            }
            window.removeEventListener('resize', updateVideoBounds);
        };
    }, []);

    const handleMouseDown = (e: React.MouseEvent, action: 'drag' | 'resize', handle?: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (action === 'drag') {
            setIsDragging(true);
            setDragStart({
                x: e.clientX,
                y: e.clientY,
                roiX: roi.x,
                roiY: roi.y
            });
        } else if (action === 'resize' && handle) {
            setIsResizing(handle);
            setResizeStart({
                x: e.clientX,
                y: e.clientY,
                roi: { ...roi }
            });
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!videoBounds) return;

            if (isDragging && dragStart) {
                const deltaX = ((e.clientX - dragStart.x) / videoBounds.width) * 100;
                const deltaY = ((e.clientY - dragStart.y) / videoBounds.height) * 100;

                const newX = Math.max(0, Math.min(100 - roi.width, dragStart.roiX + deltaX));
                const newY = Math.max(0, Math.min(100 - roi.height, dragStart.roiY + deltaY));

                setRoi(prev => ({ ...prev, x: newX, y: newY }));
            } else if (isResizing && resizeStart) {
                const deltaX = ((e.clientX - resizeStart.x) / videoBounds.width) * 100;
                const deltaY = ((e.clientY - resizeStart.y) / videoBounds.height) * 100;

                let newRoi = { ...resizeStart.roi };

                switch (isResizing) {
                    case 'nw':
                        newRoi.x = Math.max(0, Math.min(resizeStart.roi.x + resizeStart.roi.width - 5, resizeStart.roi.x + deltaX));
                        newRoi.y = Math.max(0, Math.min(resizeStart.roi.y + resizeStart.roi.height - 5, resizeStart.roi.y + deltaY));
                        newRoi.width = resizeStart.roi.width - (newRoi.x - resizeStart.roi.x);
                        newRoi.height = resizeStart.roi.height - (newRoi.y - resizeStart.roi.y);
                        break;
                    case 'ne':
                        newRoi.y = Math.max(0, Math.min(resizeStart.roi.y + resizeStart.roi.height - 5, resizeStart.roi.y + deltaY));
                        newRoi.width = Math.max(5, Math.min(100 - resizeStart.roi.x, resizeStart.roi.width + deltaX));
                        newRoi.height = resizeStart.roi.height - (newRoi.y - resizeStart.roi.y);
                        break;
                    case 'sw':
                        newRoi.x = Math.max(0, Math.min(resizeStart.roi.x + resizeStart.roi.width - 5, resizeStart.roi.x + deltaX));
                        newRoi.width = resizeStart.roi.width - (newRoi.x - resizeStart.roi.x);
                        newRoi.height = Math.max(5, Math.min(100 - resizeStart.roi.y, resizeStart.roi.height + deltaY));
                        break;
                    case 'se':
                        newRoi.width = Math.max(5, Math.min(100 - resizeStart.roi.x, resizeStart.roi.width + deltaX));
                        newRoi.height = Math.max(5, Math.min(100 - resizeStart.roi.y, resizeStart.roi.height + deltaY));
                        break;
                }

                setRoi(newRoi);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(null);
            setDragStart(null);
            setResizeStart(null);
        };

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, dragStart, resizeStart, roi.width, roi.height, videoBounds]);

    // Calculate ROI box position in pixels based on video bounds
    const getRoiBoxStyle = () => {
        if (!videoBounds) return {};

        return {
            left: `${videoBounds.x + (roi.x / 100) * videoBounds.width}px`,
            top: `${videoBounds.y + (roi.y / 100) * videoBounds.height}px`,
            width: `${(roi.width / 100) * videoBounds.width}px`,
            height: `${(roi.height / 100) * videoBounds.height}px`,
            cursor: isDragging ? 'grabbing' : 'grab'
        };
    };

    return createPortal(
        <div className="roi-modal-overlay" onClick={onCancel}>
            <div className="roi-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="roi-modal-header">
                    <h2>Set Region of Interest</h2>
                    <p>Drag the box to reposition, drag the corners to resize</p>
                </div>

                <div className="roi-video-container" ref={containerRef}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="roi-video"
                    />

                    {videoBounds && (
                        <div
                            className="roi-box"
                            style={getRoiBoxStyle()}
                            onMouseDown={(e) => handleMouseDown(e, 'drag')}
                        >
                            <div
                                className="roi-handle roi-handle-nw"
                                onMouseDown={(e) => handleMouseDown(e, 'resize', 'nw')}
                            />
                            <div
                                className="roi-handle roi-handle-ne"
                                onMouseDown={(e) => handleMouseDown(e, 'resize', 'ne')}
                            />
                            <div
                                className="roi-handle roi-handle-sw"
                                onMouseDown={(e) => handleMouseDown(e, 'resize', 'sw')}
                            />
                            <div
                                className="roi-handle roi-handle-se"
                                onMouseDown={(e) => handleMouseDown(e, 'resize', 'se')}
                            />
                        </div>
                    )}
                </div>

                <div className="roi-modal-footer">
                    <button onClick={onCancel} className="roi-cancel-button">Cancel</button>
                    <button onClick={() => onSave(roi)} className="roi-save-button">Save</button>
                </div>
            </div>
        </div>,
        document.body
    );
}
