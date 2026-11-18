import React, { useState } from 'react';
import { FaClone } from 'react-icons/fa6';
import type { PageData } from './types';

interface PageTabsProps {
    pages: PageData[];
    currentPageId: string;
    onPageChange: (pageId: string) => void;
    onPageAdd: () => void;
    onPageRename: (pageId: string, newName: string) => void;
    onPageDelete: (pageId: string) => void;
    onPageDuplicate: (pageId: string) => void;
    visible: boolean;
    readOnly?: boolean;
}

const TAB_HEIGHT = 40;
const ACTION_WIDTH = 22;

const tabActionButtonStyle: React.CSSProperties = {
    width: `${ACTION_WIDTH}px`,
    minWidth: `${ACTION_WIDTH}px`,
    height: `${TAB_HEIGHT}px`,
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    border: 'none',
    borderLeft: '1px solid #3a3a3a',
    color: '#9a9a9a',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease',
    flexShrink: 0,
};

export function PageTabs({
    pages,
    currentPageId,
    onPageChange,
    onPageAdd,
    onPageRename,
    onPageDelete,
    onPageDuplicate,
    visible,
    readOnly = false
}: PageTabsProps) {
    const [editingPageId, setEditingPageId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [hoveredPageId, setHoveredPageId] = useState<string | null>(null);

    // Hover-less devices (iPad/touch) can't reveal hover controls, so show them.
    const canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

    const handleDoubleClick = (page: PageData) => {
        if (readOnly) return;
        setEditingPageId(page.id);
        setEditingName(page.name);
    };

    const handleRenameSubmit = (pageId: string) => {
        if (editingName.trim()) {
            onPageRename(pageId, editingName.trim());
        }
        setEditingPageId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, pageId: string) => {
        if (e.key === 'Enter') {
            handleRenameSubmit(pageId);
        } else if (e.key === 'Escape') {
            setEditingPageId(null);
        }
    };

    const orderedPages = [...pages].sort((a, b) => a.order - b.order);

    return (
        <div
            style={{
                position: 'fixed',
                bottom: (visible || editingPageId !== null) ? '16px' : '-100px',
                right: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'bottom 0.3s ease',
                zIndex: 9999,
                maxWidth: '50vw',
            }}
        >
            {/* Scrollable page tabs container. Always visible in edit mode so a
                single page can still be duplicated; read-only views keep the
                original 2+ pages rule. */}
            {(!readOnly || pages.length > 1) && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#555 transparent',
                        paddingBottom: '4px',
                        marginBottom: '-4px',
                    }}
                >
                    {orderedPages.map((page) => {
                        const isActive = currentPageId === page.id;
                        const showDuplicate = !canHover || hoveredPageId === page.id;

                        return (
                            <div
                                key={page.id}
                                style={{
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'stretch',
                                    backgroundColor: isActive ? '#333' : '#262626',
                                    color: '#fff',
                                    fontSize: '14px',
                                    height: `${TAB_HEIGHT}px`,
                                    fontWeight: isActive ? '600' : '400',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    transition: 'background-color 0.2s ease, border-color 0.2s ease',
                                    border: isActive ? '1px solid #61BAFA' : '1px solid #444',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                }}
                                onMouseEnter={(e) => {
                                    setHoveredPageId(page.id);
                                    if (!isActive) {
                                        e.currentTarget.style.backgroundColor = '#333';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    setHoveredPageId(null);
                                    if (!isActive) {
                                        e.currentTarget.style.backgroundColor = '#262626';
                                    }
                                }}
                            >
                                <div
                                    style={{
                                        padding: '8px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        flex: '0 0 auto',
                                    }}
                                    onClick={() => onPageChange(page.id)}
                                    onDoubleClick={() => handleDoubleClick(page)}
                                >
                                    {editingPageId === page.id ? (
                                        <input
                                            type="text"
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onBlur={() => handleRenameSubmit(page.id)}
                                            onKeyDown={(e) => handleKeyDown(e, page.id)}
                                            autoFocus
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#fff',
                                                fontSize: '14px',
                                                fontWeight: '600',
                                                outline: 'none',
                                                width: `${editingName.length * 9.5}px`,
                                                minWidth: `${page.name.length * 9.5}px`,
                                                padding: 0,
                                                margin: 0,
                                                height: `${TAB_HEIGHT}px`,
                                                lineHeight: '1',
                                                fontFamily: 'inherit',
                                                boxSizing: 'content-box',
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span style={{ whiteSpace: 'nowrap', lineHeight: '1' }}>{page.name}</span>
                                    )}
                                </div>

                                {/* Tab actions - hidden in display/read-only mode */}
                                {!readOnly && (
                                    <div style={{ display: 'flex', alignItems: 'stretch', marginLeft: '4px' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onPageDuplicate(page.id);
                                            }}
                                            style={{
                                                ...tabActionButtonStyle,
                                                opacity: showDuplicate ? 1 : 0,
                                                pointerEvents: showDuplicate ? 'auto' : 'none',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                                                e.currentTarget.style.color = '#fff';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = '#9a9a9a';
                                            }}
                                            title="Duplicate page"
                                            aria-label="Duplicate page"
                                        >
                                            <FaClone style={{ fontSize: '13px' }} />
                                        </button>

                                        {pages.length > 1 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onPageDelete(page.id);
                                                }}
                                                style={{
                                                    ...tabActionButtonStyle,
                                                    fontSize: '20px',
                                                    lineHeight: '1',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                                                    e.currentTarget.style.color = '#fff';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.color = '#9a9a9a';
                                                }}
                                                title="Delete page"
                                                aria-label="Delete page"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add page button - only show if not read-only */}
            {!readOnly && (
                <button
                    onClick={onPageAdd}
                    style={{
                        backgroundColor: '#333',
                        color: '#fff',
                        padding: '8px 12px',
                        border: '1px solid #444',
                        fontSize: '18px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        lineHeight: '1',
                        transition: 'background-color 0.2s ease, border-color 0.2s ease',
                        flexShrink: 0,
                        width: `${TAB_HEIGHT}px`,
                        height: `${TAB_HEIGHT}px`,
                        borderRadius: '6px'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#3a3a3a';
                        e.currentTarget.style.borderColor = '#61BAFA';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#333';
                        e.currentTarget.style.borderColor = '#444';
                    }}
                    title="Add new page"
                    aria-label="Add new page"
                >
                    +
                </button>
            )}
        </div>
    );
}
