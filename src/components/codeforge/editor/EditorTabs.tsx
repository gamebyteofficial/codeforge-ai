'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { getFileIcon } from '@/lib/file-icons';
import type { ProjectFile } from '@/store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_TAB_WIDTH = 160;
export const MIN_TAB_WIDTH = 80;
export const MAX_OPEN_TABS = 10;

// ---------------------------------------------------------------------------
// Tab context menu
// ---------------------------------------------------------------------------

interface TabContextMenuProps {
  x: number;
  y: number;
  fileId: string;
  onClose: () => void;
  onCloseOthers: (id: string) => void;
  onCloseAll: () => void;
}

export function TabContextMenu({ x, y, fileId, onClose, onCloseOthers, onCloseAll }: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-md border border-zinc-700 bg-zinc-800 py-1 shadow-xl"
      style={{ left: x, top: y }}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
        onClick={() => { onCloseOthers(fileId); onClose(); }}
      >
        Close Others
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
        onClick={() => { onCloseAll(); onClose(); }}
      >
        Close All
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditorTab
// ---------------------------------------------------------------------------

interface EditorTabProps {
  file: ProjectFile;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent, fileId: string) => void;
}

const EditorTab = React.memo(function EditorTab({
  file,
  isActive,
  onClick,
  onClose,
  onContextMenu,
}: EditorTabProps) {
  const icon = useMemo(() => getFileIcon(file.name), [file.name]);

  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={onClick}
      onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onClose(); } }}
      onContextMenu={(e) => onContextMenu(e, file.id)}
      className={`group flex shrink-0 items-center gap-1.5 border-r border-zinc-800 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer select-none ${
        isActive
          ? 'bg-zinc-800 border-b-2 border-b-emerald-500 text-zinc-100'
          : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
      }`}
      style={{ minWidth: MIN_TAB_WIDTH, maxWidth: MAX_TAB_WIDTH }}
    >
      {/* File icon */}
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{file.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="ml-auto flex size-4 shrink-0 items-center justify-center rounded text-zinc-600 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
        aria-label={`Close ${file.name}`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
});

// ---------------------------------------------------------------------------
// EditorTabs (tab bar)
// ---------------------------------------------------------------------------

interface EditorTabsProps {
  openFileObjects: ProjectFile[];
  activeFileId: string | null;
  onTabClick: (fileId: string) => void;
  onCloseTab: (fileId: string) => void;
  onContextMenu: (e: React.MouseEvent, fileId: string) => void;
  tabBarRef: React.RefObject<HTMLDivElement | null>;
  contextMenu: { x: number; y: number; fileId: string } | null;
  onCloseContextMenu: () => void;
  onCloseOthers: (keepId: string) => void;
  onCloseAll: () => void;
}

export default function EditorTabs({
  openFileObjects,
  activeFileId,
  onTabClick,
  onCloseTab,
  onContextMenu,
  tabBarRef,
  contextMenu,
  onCloseContextMenu,
  onCloseOthers,
  onCloseAll,
}: EditorTabsProps) {
  return (
    <>
      {/* Tab bar */}
      <div
        ref={tabBarRef}
        data-tab-bar-scroll
        className="flex h-[34px] shrink-0 items-stretch overflow-x-auto border-b border-zinc-800 bg-zinc-900"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {openFileObjects.length === 0 ? (
          <div className="flex items-center px-3">
            <span className="text-xs text-zinc-600">No open files</span>
          </div>
        ) : (
          openFileObjects.map(file => (
            <EditorTab
              key={file.id}
              file={file}
              isActive={file.id === activeFileId}
              onClick={() => onTabClick(file.id)}
              onClose={() => onCloseTab(file.id)}
              onContextMenu={onContextMenu}
            />
          ))
        )}
      </div>

      {/* Hide scrollbar for tab bar */}
      <style>{`
        [data-tab-bar-scroll]::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Context menu */}
      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          fileId={contextMenu.fileId}
          onClose={onCloseContextMenu}
          onCloseOthers={onCloseOthers}
          onCloseAll={onCloseAll}
        />
      )}
    </>
  );
}
