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
import { useMemo, useState, useTransition } from 'react';
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
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:px-0">
          {stages.map((stage) => (
            <Column key={stage.id} orgId={orgId} stage={stage} deals={columns.get(stage.id) ?? []} />
          ))}
        </div>
        <DragOverlay>{active ? <DealCard orgId={orgId} deal={active} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ orgId, stage, deals }: { orgId: string; stage: BoardStage; deals: BoardDeal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: 'column' } });
  const total = deals.reduce((sum, d) => sum + d.value, 0);
  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.name}: ${deals.length} deals, ${formatRupiah(total)}`}
      className={cx(
        'flex w-72 shrink-0 flex-col rounded-card border bg-subtle/70 transition-colors',
        isOver ? 'border-primary bg-primary-soft' : 'border-border',
      )}
    >
      <header className="flex items-baseline justify-between gap-2 px-3 pt-3 pb-2">
        <h2 className="text-sm font-semibold">
          {stage.name} <span className="font-normal text-muted">{deals.length}</span>
        </h2>
        <span className="text-xs tabular-nums text-muted">
          {formatRupiahShort(total)}
          {stage.kind === 'open' ? ` · ${stage.probability}%` : ''}
        </span>
      </header>
      <ul className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {deals.map((deal) => (
          <li key={deal.id}>
            <DealCard orgId={orgId} deal={deal} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function DealCard({ orgId, deal, overlay = false }: { orgId: string; deal: BoardDeal; overlay?: boolean }) {
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
        'rounded-control border border-border bg-surface p-3 text-sm shadow-sm',
        deal.editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        isDragging && !overlay && 'opacity-40',
        overlay && 'rotate-1 shadow-lg',
      )}
    >
      <p className="font-medium leading-snug">{deal.title}</p>
      <p className="mt-1 tabular-nums">{formatRupiah(deal.value)}</p>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
        {deal.contact ? (
          <Link href={`/o/${orgId}/contacts/${deal.contact.id}`} className="truncate hover:text-foreground hover:underline" onPointerDown={(e) => e.stopPropagation()}>
            {deal.contact.full_name}
          </Link>
        ) : (
          <span>No contact</span>
        )}
        <span className="shrink-0" title={deal.editable ? undefined : 'Owned by a teammate: read-only'}>
          {deal.editable ? null : <span aria-hidden="true">🔒 </span>}
          {deal.ownerName?.split(' ')[0] ?? 'Unassigned'}
        </span>
      </div>
      {deal.expectedClose ? <p className="mt-1 text-xs text-muted">Close by {formatDate(deal.expectedClose)}</p> : null}
    </article>
  );
}
