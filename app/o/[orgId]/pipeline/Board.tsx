'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Alert, cx } from '@/components/ui';
import { moveDeal } from '@/features/deals/actions';
import { formatDate, formatRupiah, formatRupiahShort } from '@/lib/format';
import { positionBetween } from './position';

export type BoardStage = { id: string; name: string; kind: 'open' | 'won' | 'lost'; probability: number };
export type BoardDeal = {
  id: string;
  title: string;
  value: number;
  stageId: string;
  position: number;
  expectedClose: string | null;
  contact: { id: string; full_name: string } | null;
  ownerName: string | null;
  editable: boolean;
};

export function Board({ orgId, stages, initialDeals }: { orgId: string; stages: BoardStage[]; initialDeals: BoardDeal[] }) {
  const [deals, setDeals] = useState(initialDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // New data from the server (a new deal, a refresh) replaces the local copy.
  const [serverDeals, setServerDeals] = useState(initialDeals);
  if (initialDeals !== serverDeals) {
    setServerDeals(initialDeals);
    setDeals(initialDeals);
  }

  const sensors = useSensors(
    // A small distance so a click on the contact link is not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const columns = useMemo(() => {
    const byStage = new Map(stages.map((s) => [s.id, [] as BoardDeal[]]));
    for (const deal of deals) byStage.get(deal.stageId)?.push(deal);
    for (const list of byStage.values()) list.sort((a, b) => a.position - b.position);
    return byStage;
  }, [deals, stages]);

  const active = deals.find((d) => d.id === activeId) ?? null;
  const openStages = stages.filter((s) => s.kind === 'open');
  const closedStages = stages.filter((s) => s.kind !== 'open');

  // The board is wider than the page on most laptops: fade the right edge while there is more to scroll to.
  const scroller = useRef<HTMLDivElement>(null);
  const [moreRight, setMoreRight] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  function onDragStart(event: DragStartEvent) {
    setError(null);
    setActiveId(String(event.active.id));
  }

  function onDragEnd({ active: dragged, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const deal = deals.find((d) => d.id === dragged.id);
    if (!deal) return;

    // Dropped on a card: take its place (the card moves down). Dropped on a column: go last.
    const overCard = over.data.current?.type === 'card' ? deals.find((d) => d.id === over.id) : undefined;
    const stageId = overCard ? overCard.stageId : String(over.id);
    if (overCard?.id === deal.id) return;
    const full = columns.get(stageId) ?? [];
    const column = full.filter((d) => d.id !== deal.id);
    let index = overCard ? column.findIndex((d) => d.id === overCard.id) : column.length;
    // Within a column, dropping on a card below takes the slot after it (moving down).
    if (overCard && stageId === deal.stageId && full.indexOf(deal) < full.indexOf(overCard)) index += 1;
    if (stageId === deal.stageId && index === full.indexOf(deal)) return;
    const position = positionBetween(column[index - 1]?.position, column[index]?.position);

    const previous = deals;
    setDeals(deals.map((d) => (d.id === deal.id ? { ...d, stageId, position } : d)));
    startTransition(async () => {
      const result = await moveDeal(orgId, deal.id, stageId, position);
      if (!result.ok) {
        setDeals(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {error ? <Alert>{error}</Alert> : null}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="relative">
          <div ref={scroller} className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:px-0">
            {openStages.map((stage) => (
              <Column key={stage.id} orgId={orgId} stage={stage} deals={columns.get(stage.id) ?? []} />
            ))}
            {/* Won and Lost share one lane: they are outcomes to drop onto, not stages to work in. */}
            {closedStages.length ? (
              <div className="flex w-64 shrink-0 flex-col gap-3">
                {closedStages.map((stage) => (
                  <Column key={stage.id} orgId={orgId} stage={stage} deals={columns.get(stage.id) ?? []} compact />
                ))}
              </div>
            ) : null}
          </div>
          <div
            aria-hidden="true"
            className={cx(
              'pointer-events-none absolute inset-y-0 right-0 hidden w-24 bg-linear-to-l from-background via-background/70 to-transparent transition-opacity lg:block',
              moreRight ? 'opacity-100' : 'opacity-0',
            )}
          />
        </div>
        <DragOverlay>{active ? <DealCard orgId={orgId} deal={active} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

const accent = { open: 'border-t-primary', won: 'border-t-success', lost: 'border-t-danger/60' } as const;

function Column({ orgId, stage, deals, compact = false }: { orgId: string; stage: BoardStage; deals: BoardDeal[]; compact?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: 'column' } });
  const total = deals.reduce((sum, d) => sum + d.value, 0);
  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.name}: ${deals.length} deals, ${formatRupiah(total)}`}
      className={cx(
        'flex shrink-0 flex-col rounded-card border border-t-[3px] bg-subtle/70 transition-colors',
        compact ? 'w-full' : 'w-64 self-stretch',
        accent[stage.kind],
        isOver ? 'border-x-primary border-b-primary bg-primary-soft' : 'border-x-border border-b-border',
      )}
    >
      <header className="px-3 pt-3 pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {stage.name} <span className="font-normal text-muted">{deals.length}</span>
          </h2>
          {stage.kind === 'open' ? (
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted">{stage.probability}%</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatRupiahShort(total)}</p>
      </header>
      <ul className={cx('flex flex-1 flex-col gap-2 px-2 pb-2', compact ? 'min-h-14' : 'min-h-24')}>
        {deals.map((deal) => (
          <li key={deal.id}>
            <DealCard orgId={orgId} deal={deal} compact={compact} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

function DealCard({ orgId, deal, overlay = false, compact = false }: { orgId: string; deal: BoardDeal; overlay?: boolean; compact?: boolean }) {
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({ id: deal.id, data: { type: 'card' }, disabled: !deal.editable || overlay });
  const { setNodeRef: dropRef } = useDroppable({ id: deal.id, data: { type: 'card' }, disabled: overlay });

  return (
    <article
      ref={(node) => {
        dragRef(node);
        dropRef(node);
      }}
      {...attributes}
      {...listeners}
      aria-roledescription={deal.editable ? 'draggable deal' : 'deal'}
      aria-label={`${deal.title}, ${formatRupiah(deal.value)}`}
      className={cx(
        'rounded-control border border-border bg-surface text-sm shadow-sm transition-shadow hover:shadow',
        compact ? 'px-3 py-2' : 'p-3',
        deal.editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        isDragging && !overlay && 'opacity-40',
        overlay && 'rotate-1 shadow-lg',
      )}
    >
      {compact ? (
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-medium">{deal.title}</p>
          <p className="shrink-0 text-xs tabular-nums text-muted">{formatRupiahShort(deal.value)}</p>
        </div>
      ) : (
        <>
          <p className="font-medium leading-snug">{deal.title}</p>
          <p className="mt-1 font-semibold tabular-nums">{formatRupiah(deal.value)}</p>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
            {deal.contact ? (
              <Link href={`/o/${orgId}/contacts/${deal.contact.id}`} className="truncate hover:text-foreground hover:underline" onPointerDown={(e) => e.stopPropagation()}>
                {deal.contact.full_name}
              </Link>
            ) : (
              <span>No contact</span>
            )}
            <span
              className={cx(
                'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                deal.editable ? 'bg-primary-soft text-primary-ink' : 'bg-subtle text-muted',
              )}
              title={`${deal.ownerName ?? 'Unassigned'}${deal.editable ? '' : ' (read-only)'}`}
            >
              <span className="sr-only">
                Owner: {deal.ownerName ?? 'Unassigned'}
                {deal.editable ? '' : ', read-only'}
              </span>
              <span aria-hidden="true">{initials(deal.ownerName)}</span>
            </span>
          </div>
          {deal.expectedClose ? <p className="mt-1 text-xs text-muted">Close by {formatDate(deal.expectedClose)}</p> : null}
        </>
      )}
    </article>
  );
}
