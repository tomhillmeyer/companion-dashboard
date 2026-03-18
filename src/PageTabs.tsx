import React, { useState } from 'react';
import type { PageData } from './types';

interface PageTabsProps {
    pages: PageData[];
    currentPageId: string;
    onPageChange: (pageId: string) => void;
    onPageAdd: () => void;
    onPageRename: (pageId: string, newName: string) => void;
    onPageDelete: (pageId: string) => void;
    visible: boolean;
    readOnly?: boolean;
}

export function PageTabs({
    pages,
    currentPageId,
    onPageChange,
    onPageAdd,
    onPageRename,
    onPageDelete,
    visible,
    readOnly = false
}: PageTabsProps) {
    const [editingPageId, setEditingPageId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

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
            }}
        >
            {/* Page tabs - only show if more than one page */}
            {pages.length > 1 && pages
                .sort((a, b) => a.order - b.order)
                .map((page) => (
                    <div
                        key={page.id}
                        style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'stretch',
                            backgroundColor: currentPageId === page.id ? '#555' : '#2a2a2a',
                            color: '#fff',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: currentPageId === page.id ? '600' : '400',
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'background-color 0.2s ease',
                            border: currentPageId === page.id ? '1px solid #777' : '1px solid #444',
                            overflow: 'hidden',
                        }}
                        onMouseEnter={(e) => {
                            if (currentPageId !== page.id) {
                                e.currentTarget.style.backgroundColor = '#3a3a3a';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (currentPageId !== page.id) {
                                e.currentTarget.style.backgroundColor = '#2a2a2a';
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
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        outline: 'none',
                                        width: `${editingName.length * 8.2}px`,
                                        minWidth: `${page.name.length * 8.2}px`,
                                        padding: 0,
                                        margin: 0,
                                        height: '1em',
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

                        {/* Delete button - only show if more than one page and not read-only */}
                        {pages.length > 1 && !readOnly && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Delete page "${page.name}"? All boxes on this page will be deleted.`)) {
                                        onPageDelete(page.id);
                                    }
                                }}
                                style={{
                                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                                    border: 'none',
                                    borderLeft: '1px solid #444',
                                    color: '#aaa',
                                    cursor: 'pointer',
                                    padding: '0 10px',
                                    opacity: 0.7,
                                    fontSize: '16px',
                                    lineHeight: '1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background-color 0.2s ease, opacity 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = '0.7';
                                    e.currentTarget.style.color = '#aaa';
                                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                                }}
                                title="Delete page"
                            >
                                ×
                            </button>
                        )}
                    </div>
                ))}

            {/* Add page button - only show if not read-only */}
            {!readOnly && (
                <button
                    onClick={onPageAdd}
                    style={{
                        backgroundColor: '#3a3a3a',
                        color: '#fff',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #555',
                        fontSize: '18px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        lineHeight: '1',
                        transition: 'background-color 0.2s ease',
                        flexShrink: 0,
                        width: 'auto',
                        minWidth: 'auto',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#4a4a4a';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#3a3a3a';
                    }}
                    title="Add new page"
                >
                    +
                </button>
            )}
        </div>
    );
}
