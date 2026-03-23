import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip } from './Tooltip';
import { EmojiPickerPopover, type EmojiPickerAnchor } from './EmojiPickerPopover';
import { UserAvatar } from './UserAvatar';

export type CommentThreadMessage = {
  id: string;
  message: string;
  author: string;
  createdAt: number;
  /** Mapa emoji → quem reagiu (ex.: `'me'` = utilizador local). */
  reactions?: Record<string, string[]>;
};

export type CommentThreadPanelProps = {
  comments: CommentThreadMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onResolve: () => void;
  onClose: () => void;
  /** Rótulo do elemento comentado (opcional, abaixo do título). */
  contextLabel?: string;
  onEditComment?: (commentId: string, message: string) => void;
  onDeleteComment?: (commentId: string) => void;
  /** Alterna reação do utilizador atual (emoji). */
  onToggleReaction?: (commentId: string, emoji: string) => void;
  /** Identificador do reator local (default `me`). */
  currentUserId?: string;
};

export type MentionableUser = {
  id: string;
  name: string;
  email: string;
  rank: number;
  /** Ilustração do avatar (ex.: mesmo asset da sidebar). */
  avatarSrc?: string;
};

const DEFAULT_MENTION_USERS: MentionableUser[] = [
  {
    id: 'cm-agent',
    name: 'Campaign Manager',
    email: 'Agente',
    rank: 1,
    avatarSrc: '/megaphone.png',
  },
  { id: 'br-1', name: 'Beatriz Azevedo', email: 'beatriz_azevedo@apple.com', rank: 2 },
  { id: 'br-2', name: 'Lucas Ferreira', email: 'lucas_ferreira@apple.com', rank: 3 },
  { id: 'br-3', name: 'Mariana Costa', email: 'mariana_costa@apple.com', rank: 4 },
  { id: 'br-4', name: 'Rafael Okamoto', email: 'rafael_okamoto@apple.com', rank: 5 },
  { id: 'br-5', name: 'Juliana Prado', email: 'juliana_prado@apple.com', rank: 6 },
  { id: 'br-6', name: 'Felipe Barros', email: 'felipe_barros@apple.com', rank: 7 },
  { id: 'br-7', name: 'Camila Santana', email: 'camila_santana@apple.com', rank: 8 },
];

function sortUsersByLikelihood(users: MentionableUser[], commentAuthors: string[]): MentionableUser[] {
  const authorSet = new Set(commentAuthors.map((a) => a.toLowerCase()));
  return [...users].sort((a, b) => {
    const aIn = authorSet.has(a.name.toLowerCase()) ? 0 : 1;
    const bIn = authorSet.has(b.name.toLowerCase()) ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;
    return a.rank - b.rank;
  });
}

function filterMentionUsers(users: MentionableUser[], query: string): MentionableUser[] {
  const q = query.trim().toLowerCase();
  const base = q
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
    : users;
  return base.slice(0, 8);
}

function getActiveMention(value: string, cursor: number): { start: number; query: string } | null {
  const before = value.slice(0, cursor);
  const lastAt = before.lastIndexOf('@');
  if (lastAt === -1) return null;
  const afterAt = before.slice(lastAt + 1);
  if (/[\s\n\r]/.test(afterAt)) return null;
  return { start: lastAt, query: afterAt };
}

function formatRelativeTimePt(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'Agora';
  const min = Math.floor(sec / 60);
  if (min < 60) return min <= 1 ? 'Há 1 min' : `Há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? 'Há 1 hora' : `Há ${h} horas`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? 'Há 1 dia' : `Há ${d} dias`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const Avatar: React.FC = () => (
  <div className="shrink-0 size-6 rounded-full bg-[#e8e8e8]" aria-hidden />
);

/** Mesmo asset da sidebar / AgentWelcome (`/megaphone.png`). */
const CAMPAIGN_MANAGER_AVATAR_SRC = '/megaphone.png';

const CommentAuthorAvatar: React.FC<{ author: string }> = ({ author }) => {
  if (author === 'Campaign Manager') {
    return (
      <div
        className="shrink-0 size-6 rounded-full bg-[#ecf0f5] flex items-center justify-center overflow-hidden"
        aria-hidden
      >
        <img src={CAMPAIGN_MANAGER_AVATAR_SRC} alt="" className="size-[22px] object-contain" />
      </div>
    );
  }
  if (author === 'Você') {
    return <UserAvatar size="sm" />;
  }
  return <Avatar />;
};

const MentionAvatar: React.FC<{ name: string; hue: number; avatarSrc?: string }> = ({ name, hue, avatarSrc }) => {
  if (avatarSrc) {
    return (
      <div
        className="shrink-0 size-8 rounded-full bg-[#ecf0f5] flex items-center justify-center overflow-hidden"
        aria-hidden
      >
        <img src={avatarSrc} alt="" className="w-8 h-8 object-contain" />
      </div>
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className="shrink-0 size-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white"
      style={{ background: `hsl(${hue} 42% 46%)` }}
      aria-hidden
    >
      {initial}
    </div>
  );
};

function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

type ParsedMessageSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; user: MentionableUser };

function isMentionBoundary(ch: string | undefined): boolean {
  if (ch === undefined) return true;
  if (/\s/.test(ch)) return true;
  return /[.,;:!?)\]}]/.test(ch);
}

/** Reconhece `@Nome` igual ao da lista de menções (escolha válida no picker). */
function parseMessageWithMentions(text: string, users: MentionableUser[]): ParsedMessageSegment[] {
  const byLen = [...users].sort((a, b) => b.name.length - a.name.length);
  const segments: ParsedMessageSegment[] = [];
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf('@', i);
    if (at === -1) {
      if (i < text.length) {
        segments.push({ type: 'text', value: text.slice(i) });
      }
      break;
    }
    if (at > i) {
      segments.push({ type: 'text', value: text.slice(i, at) });
    }
    let matched: MentionableUser | null = null;
    const rest = text.slice(at + 1);
    for (const u of byLen) {
      if (rest.startsWith(u.name) && isMentionBoundary(text[at + 1 + u.name.length])) {
        matched = u;
        break;
      }
    }
    if (matched) {
      segments.push({ type: 'mention', user: matched });
      i = at + 1 + matched.name.length;
    } else {
      segments.push({ type: 'text', value: '@' });
      i = at + 1;
    }
  }
  return segments;
}

const CommentMessageBody: React.FC<{ text: string }> = ({ text }) => {
  const segments = useMemo(() => parseMessageWithMentions(text, DEFAULT_MENTION_USERS), [text]);
  return (
    <div className="text-[14px] font-normal leading-5 tracking-[-0.14px] text-[#1f1f1f] whitespace-pre-wrap break-words">
      {segments.map((seg, idx) =>
        seg.type === 'text' ? (
          <span key={idx}>{seg.value}</span>
        ) : (
          <Tooltip
            key={idx}
            position="top"
            inline
            zIndex={10080}
            content={
              <div className="flex items-center gap-2.5">
                <MentionAvatar name={seg.user.name} hue={hueFromId(seg.user.id)} avatarSrc={seg.user.avatarSrc} />
                <div className="flex min-w-0 max-w-[240px] flex-col text-left">
                  <span className="truncate text-[13px] font-semibold leading-tight text-white">{seg.user.name}</span>
                  <span className="truncate text-[11px] font-normal leading-snug text-white/75">{seg.user.email}</span>
                </div>
              </div>
            }
          >
            <span className="font-medium text-[#2563eb]">@{seg.user.name}</span>
          </Tooltip>
        )
      )}
    </div>
  );
};

type MessageMenuPosition =
  | { placement: 'below'; top: number; left: number }
  | { placement: 'above'; bottom: number; left: number };

const MESSAGE_MENU_MIN_W = 140;
const MESSAGE_MENU_EST_HEIGHT = 100;
const MESSAGE_MENU_GAP = 4;

function computeMessageMenuPosition(triggerEl: HTMLElement): MessageMenuPosition {
  const rect = triggerEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - MESSAGE_MENU_GAP;
  const spaceAbove = rect.top - MESSAGE_MENU_GAP;
  const openUp =
    spaceBelow < MESSAGE_MENU_EST_HEIGHT && spaceAbove > spaceBelow;

  const left = Math.max(
    8,
    Math.min(rect.right - MESSAGE_MENU_MIN_W, window.innerWidth - MESSAGE_MENU_MIN_W - 8)
  );

  if (openUp) {
    return {
      placement: 'above',
      left,
      bottom: window.innerHeight - rect.top + MESSAGE_MENU_GAP,
    };
  }
  return {
    placement: 'below',
    left,
    top: rect.bottom + MESSAGE_MENU_GAP,
  };
}

const CommentMessageRow: React.FC<{
  comment: CommentThreadMessage;
  onEdit?: (id: string, message: string) => void;
  onDelete?: (id: string) => void;
  onToggleReaction?: (commentId: string, emoji: string) => void;
  currentUserId?: string;
}> = ({ comment, onEdit, onDelete, onToggleReaction, currentUserId = 'me' }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MessageMenuPosition | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(comment.message);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<EmojiPickerAnchor | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const floatingMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addReactionRef = useRef<HTMLButtonElement>(null);

  const showMenu = Boolean(onEdit || onDelete);

  const reactionEntries = useMemo(() => {
    const r = comment.reactions ?? {};
    return (Object.entries(r) as [string, string[]][])
      .filter(([, users]) => users.length > 0)
      .sort((a, b) => b[1].length - a[1].length);
  }, [comment.reactions]);

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    setMenuPos(computeMessageMenuPosition(el));
  }, []);

  useEffect(() => {
    setEditDraft(comment.message);
  }, [comment.id, comment.message]);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (floatingMenuRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const rel = formatRelativeTimePt(comment.createdAt);

  const saveEdit = () => {
    const t = editDraft.trim();
    if (t && onEdit) onEdit(comment.id, t);
    setEditing(false);
    setMenuOpen(false);
  };

  const cancelEdit = () => {
    setEditDraft(comment.message);
    setEditing(false);
  };

  const openReactionPicker = () => {
    const el = addReactionRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPickerAnchor({ left: r.left, top: r.top, width: r.width, height: r.height });
    setPickerOpen(true);
  };

  return (
    <>
      <div className="flex gap-2 w-full min-w-0">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-3 min-w-0 pr-1">
            <CommentAuthorAvatar author={comment.author} />
            <span className="text-[14px] font-semibold leading-5 tracking-[-0.14px] text-[#1f1f1f] truncate">
              {comment.author}
            </span>
            <span className="text-[14px] font-normal leading-5 tracking-[-0.14px] text-[#999] shrink-0">
              {rel}
            </span>
          </div>
          <div className="pl-[38px] w-full min-w-0">
            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={textareaRef}
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  className="w-full min-h-[72px] rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-2 text-[14px] leading-5 tracking-[-0.14px] text-[#1f1f1f] outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelEdit();
                    }
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      saveEdit();
                    }
                  }}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 text-[13px] text-[#666] hover:bg-black/[0.05]"
                    onClick={cancelEdit}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-[#2563eb] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={saveEdit}
                    disabled={!editDraft.trim()}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <CommentMessageBody text={comment.message} />
            )}
          </div>
          {!editing && reactionEntries.length > 0 ? (
            <div className="pl-11 flex flex-wrap items-center gap-2">
              {reactionEntries.map(([emoji, users]) => {
                const n = users.length;
                const mine = users.includes(currentUserId);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onToggleReaction?.(comment.id, emoji)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[13px] leading-none transition-colors ${
                      mine
                        ? 'border-[#2563eb] bg-[#eff6ff] text-[#1e40af]'
                        : 'border-[#e5e5e5] bg-white text-[#1f1f1f] hover:bg-[#fafafa]'
                    }`}
                    aria-pressed={mine}
                    aria-label={`Reação ${emoji}, ${n}`}
                  >
                    <span className="text-[16px] leading-none">{emoji}</span>
                    <span className="tabular-nums text-[12px] font-medium">{n}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
          {showMenu ? (
            <div className="relative shrink-0" ref={triggerRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="size-6 inline-flex items-center justify-center rounded-md text-[#999] hover:bg-black/[0.06] hover:text-[#1f1f1f] transition-colors"
                aria-label="Ações da mensagem"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="material-symbols-outlined text-[20px]">more_vert</span>
              </button>
              {menuOpen && menuPos
                ? createPortal(
                    <div
                      ref={floatingMenuRef}
                      data-comment-thread-portal=""
                      className="min-w-[140px] rounded-[10px] border border-[#ebebeb] bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.1)]"
                      role="menu"
                      style={{
                        position: 'fixed',
                        zIndex: 10070,
                        left: menuPos.left,
                        ...(menuPos.placement === 'below'
                          ? { top: menuPos.top }
                          : { bottom: menuPos.bottom }),
                      }}
                    >
                      {onEdit ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center px-3 py-2.5 text-left text-[14px] leading-5 text-[#1f1f1f] hover:bg-[#fafafa] transition-colors"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setEditing(true);
                            setMenuOpen(false);
                          }}
                        >
                          Editar
                        </button>
                      ) : null}
                      {onDelete ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center px-3 py-2.5 text-left text-[14px] leading-5 text-[#b91c1c] hover:bg-red-50 transition-colors"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            onDelete(comment.id);
                            setMenuOpen(false);
                          }}
                        >
                          Apagar
                        </button>
                      ) : null}
                    </div>,
                    document.body
                  )
                : null}
            </div>
          ) : null}
          {onToggleReaction ? (
            <Tooltip text="Adicionar reação" position="bottom" zIndex={10095}>
              <button
                ref={addReactionRef}
                type="button"
                onClick={openReactionPicker}
                className="size-8 inline-flex items-center justify-center rounded-lg border-0 bg-white text-[#888] transition-colors hover:bg-black/[0.04] hover:text-[#1f1f1f]"
                aria-label="Adicionar reação"
              >
                <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
              </button>
            </Tooltip>
          ) : null}
        </div>
      </div>
      {onToggleReaction ? (
        <EmojiPickerPopover
          open={pickerOpen}
          anchor={pickerAnchor}
          onClose={() => {
            setPickerOpen(false);
            setPickerAnchor(null);
          }}
          onSelect={(emoji) => onToggleReaction(comment.id, emoji)}
        />
      ) : null}
    </>
  );
};

const ThreadIconButton: React.FC<{
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}> = ({ onClick, label, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="shrink-0 size-9 inline-flex items-center justify-center rounded-lg text-[color:var(--sl-fg-base-soft)] hover:bg-black/[0.06] transition-colors"
    aria-label={label}
    title={label}
  >
    {children}
  </button>
);

export const CommentThreadPanel: React.FC<CommentThreadPanelProps> = ({
  comments,
  draft,
  onDraftChange,
  onSend,
  onResolve,
  onClose,
  contextLabel,
  onEditComment,
  onDeleteComment,
  onToggleReaction,
  currentUserId = 'me',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionAnchorRef = useRef<HTMLDivElement>(null);
  const [mentionContext, setMentionContext] = useState<{ start: number; query: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionMenuPos, setMentionMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const cursorAfterInsert = useRef<number | null>(null);

  const commentAuthors = useMemo(() => [...new Set(comments.map((c) => c.author))], [comments]);
  const orderedUsers = useMemo(
    () => sortUsersByLikelihood(DEFAULT_MENTION_USERS, commentAuthors),
    [commentAuthors]
  );

  const syncMention = useCallback((value: string, cursor: number) => {
    setMentionContext(getActiveMention(value, cursor));
  }, []);

  const filteredMentions = useMemo(() => {
    if (!mentionContext) return [];
    return filterMentionUsers(orderedUsers, mentionContext.query);
  }, [mentionContext, orderedUsers]);

  const mentionOpen = mentionContext !== null;

  useLayoutEffect(() => {
    if (!mentionOpen) {
      setMentionMenuPos(null);
      return;
    }
    const run = () => {
      const el = mentionAnchorRef.current;
      if (!el) {
        setMentionMenuPos(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setMentionMenuPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    run();
    window.addEventListener('scroll', run, true);
    window.addEventListener('resize', run);
    return () => {
      window.removeEventListener('scroll', run, true);
      window.removeEventListener('resize', run);
    };
  }, [mentionOpen, draft, filteredMentions.length, mentionContext?.query, mentionContext?.start]);

  useEffect(() => {
    if (mentionIndex >= filteredMentions.length) {
      setMentionIndex(Math.max(0, filteredMentions.length - 1));
    }
  }, [filteredMentions.length, mentionIndex]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionContext?.query, mentionContext?.start]);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const pos = cursorAfterInsert.current;
    if (pos == null || !inputRef.current) return;
    inputRef.current.setSelectionRange(pos, pos);
    cursorAfterInsert.current = null;
    syncMention(inputRef.current.value, pos);
  }, [draft, syncMention]);

  const canSend = draft.trim().length > 0;

  const insertMention = useCallback(
    (user: MentionableUser) => {
      if (!mentionContext) return;
      const { start, query } = mentionContext;
      const replaceEnd = start + 1 + query.length;
      const insertion = `@${user.name} `;
      const newVal = draft.slice(0, start) + insertion + draft.slice(replaceEnd);
      const newCursor = start + insertion.length;
      cursorAfterInsert.current = newCursor;
      setMentionContext(null);
      onDraftChange(newVal);
    },
    [draft, mentionContext, onDraftChange]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const cursor = e.target.selectionStart ?? v.length;
    onDraftChange(v);
    syncMention(v, cursor);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const t = e.currentTarget;
    syncMention(t.value, t.selectionStart ?? t.value.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionOpen && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => Math.min(filteredMentions.length - 1, i + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(filteredMentions[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (mentionContext) {
          const { start, query } = mentionContext;
          const end = start + 1 + query.length;
          const newVal = draft.slice(0, start) + draft.slice(end);
          cursorAfterInsert.current = start;
          setMentionContext(null);
          onDraftChange(newVal);
        }
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  const handleInsertAtClick = () => {
    const el = inputRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? draft.length;
    const newVal = draft.slice(0, pos) + '@' + draft.slice(pos);
    cursorAfterInsert.current = pos + 1;
    onDraftChange(newVal);
  };

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[12px] bg-white w-full max-h-[min(520px,85vh)] border border-[#ebebeb] shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
      role="dialog"
      aria-modal="false"
      aria-labelledby="comment-thread-title"
    >
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-white">
        <div className="min-w-0 flex flex-col gap-0.5">
          <h2
            id="comment-thread-title"
            className="text-[14px] font-semibold leading-5 tracking-[-0.14px] text-[#1f1f1f]"
          >
            Comentar
          </h2>
          {contextLabel ? (
            <p className="text-[12px] leading-4 tracking-[-0.12px] text-[#999] truncate" title={contextLabel}>
              {contextLabel}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThreadIconButton onClick={onResolve} label="Resolver thread">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
          </ThreadIconButton>
          <ThreadIconButton onClick={onClose} label="Fechar">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </ThreadIconButton>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-5 bg-white">
        {comments.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-10 px-2">
            <p className="text-[14px] leading-5 tracking-[-0.14px] text-[#999] text-center">
              Ainda sem comentários nesta thread.
            </p>
          </div>
        ) : (
          comments.map((c) => (
            <CommentMessageRow
              key={c.id}
              comment={c}
              onEdit={onEditComment}
              onDelete={onDeleteComment}
              onToggleReaction={onToggleReaction}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>

      <div className="shrink-0 px-4 pb-4 pt-3 bg-white border-t border-[#f0f0f0]">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
          {/* Avatar: mesma altura da linha do input (44px), centrado verticalmente */}
          <div className="row-start-1 flex w-6 items-center justify-center self-center min-h-[44px]">
            <UserAvatar size="sm" />
          </div>
          <div
            ref={mentionAnchorRef}
            className="row-start-1 col-start-2 flex min-h-[44px] items-center rounded-lg border border-transparent bg-[#f8f8f8] px-3 transition-colors focus-within:border-[#e0e0e0]"
          >
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={handleChange}
              onSelect={handleSelect}
              onKeyDown={handleKeyDown}
              placeholder="Responder"
              className="min-h-0 w-full min-w-0 flex-1 appearance-none border-none bg-transparent py-0 text-[14px] leading-5 tracking-[-0.14px] text-[#1f1f1f] outline-none placeholder:text-[#1f1f1f]/45"
              aria-label="Responder na thread"
              aria-expanded={mentionOpen}
              aria-controls="comment-mention-listbox"
              aria-autocomplete="list"
              role="combobox"
              autoComplete="off"
            />
          </div>

          <div className="col-start-2 row-start-2 flex items-center justify-between pl-1 pr-0.5">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="size-8 inline-flex items-center justify-center rounded-md text-[#999] hover:bg-black/[0.05] hover:text-[#1f1f1f] transition-colors"
                aria-label="Inserir menção"
                title="Mencionar alguém (@)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleInsertAtClick}
              >
                <span className="material-symbols-outlined text-[20px]">alternate_email</span>
              </button>
              <button
                type="button"
                className="size-8 inline-flex items-center justify-center rounded-md text-[#999] opacity-40 cursor-not-allowed"
                aria-label="Emoji (em breve)"
                title="Emoji"
                disabled
              >
                <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
              </button>
              <button
                type="button"
                className="size-8 inline-flex items-center justify-center rounded-md text-[#999] opacity-40 cursor-not-allowed"
                aria-label="Anexar imagem (em breve)"
                title="Imagem"
                disabled
              >
                <span className="material-symbols-outlined text-[20px]">image</span>
              </button>
            </div>
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className="size-9 inline-flex shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#e5e5e5] disabled:text-[#b0b0b0] disabled:opacity-40"
              aria-label="Enviar resposta"
            >
              <span className="material-symbols-outlined text-[20px]">north</span>
            </button>
          </div>
        </div>

        {mentionMenuPos &&
          mentionOpen &&
          createPortal(
            <div
              id="comment-mention-listbox"
              data-comment-thread-portal=""
              role="listbox"
              className="max-h-[min(240px,40vh)] overflow-y-auto rounded-[10px] border border-[#ebebeb] bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.1)]"
              style={{
                position: 'fixed',
                top: mentionMenuPos.top,
                left: mentionMenuPos.left,
                width: mentionMenuPos.width,
                zIndex: 10060,
              }}
            >
              {filteredMentions.length > 0 ? (
                filteredMentions.map((u, idx) => (
                  <button
                    key={u.id}
                    type="button"
                    role="option"
                    aria-selected={idx === mentionIndex}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      idx === mentionIndex ? 'bg-[#f3f3f3]' : 'hover:bg-[#fafafa]'
                    }`}
                    onMouseEnter={() => setMentionIndex(idx)}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      insertMention(u);
                    }}
                  >
                    <MentionAvatar name={u.name} hue={hueFromId(u.id)} avatarSrc={u.avatarSrc} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold leading-5 tracking-[-0.14px] text-[#1f1f1f]">
                        {u.name}
                      </p>
                      <p className="truncate text-[12px] leading-4 text-[#999]">{u.email}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-3">
                  <p className="text-[13px] text-[#999]">Nenhum usuário encontrado.</p>
                </div>
              )}
            </div>,
            document.body
          )}
      </div>
    </div>
  );
};
