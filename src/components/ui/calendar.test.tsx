import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DateRange } from 'react-day-picker';

import { Calendar } from './calendar';

const august = new Date(2026, 7, 1);
const date = (day: number) => new Date(2026, 7, day);
const dayButton = (day: number) => screen.getByRole('button', {
  name: (name) => name.includes(`, ${day} de agosto de 2026`),
});

function SingleCalendar({ onSelect }: { onSelect: (value: Date | undefined) => void }) {
  const [selected, setSelected] = useState<Date>();
  return <Calendar mode="single" defaultMonth={august} today={date(1)}
    selected={selected} onSelect={(value) => { setSelected(value); onSelect(value); }} />;
}

function RangeCalendar({ onSelect }: { onSelect: (value: DateRange | undefined) => void }) {
  const [selected, setSelected] = useState<DateRange>();
  return <Calendar mode="range" defaultMonth={august} today={date(1)}
    selected={selected} onSelect={(value) => { setSelected(value); onSelect(value); }} />;
}

describe('Calendar: migracion DayPicker 10', () => {
  it('preserves single selection and its enabled selected styling hook', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SingleCalendar onSelect={onSelect} />);
    await user.click(dayButton(10));
    expect(onSelect).toHaveBeenLastCalledWith(date(10));
    expect(dayButton(10).getAttribute('data-selected-single')).toBe('true');
    expect(dayButton(10).getAttribute('data-disabled')).toBe('false');
    expect(dayButton(10).closest('[role="gridcell"]')?.getAttribute('aria-selected')).toBe('true');
    await user.click(dayButton(10));
    expect(onSelect).toHaveBeenLastCalledWith(undefined);
  });

  it('preserves range start, middle and end after two selections', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RangeCalendar onSelect={onSelect} />);
    await user.click(dayButton(10));
    await user.click(dayButton(13));
    expect(onSelect).toHaveBeenLastCalledWith({ from: date(10), to: date(13) });
    expect(dayButton(10).getAttribute('data-range-start')).toBe('true');
    expect(dayButton(11).getAttribute('data-range-middle')).toBe('true');
    expect(dayButton(13).getAttribute('data-range-end')).toBe('true');
    expect(dayButton(11).getAttribute('data-selected-single')).toBe('false');
  });

  it('keeps disabled dates accessible and prevents selecting them', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Calendar mode="single" defaultMonth={august} today={date(1)}
      disabled={date(10)} onSelect={onSelect} />);
    const disabledDay = dayButton(10);
    expect(disabledDay.hasAttribute('disabled') || disabledDay.getAttribute('aria-disabled') === 'true').toBe(true);
    expect(disabledDay.getAttribute('data-disabled')).toBe('true');
    await user.click(disabledDay);
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(dayButton(11));
    expect(onSelect.mock.calls[0]?.[0]).toEqual(date(11));
  });

  it('applies the v10 month_grid mapping to the semantic calendar grid', () => {
    render(<Calendar defaultMonth={august} today={date(1)} />);
    const grid = screen.getByRole('grid');
    expect(grid.classList.contains('w-full')).toBe(true);
    expect(grid.classList.contains('border-collapse')).toBe(true);
    expect(grid.classList.contains('rdp-month_grid')).toBe(true);
    expect(grid.closest('[data-slot="calendar"]')).not.toBeNull();
  });

  it('preserves keyboard focus movement and selection through the custom DayButton', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SingleCalendar onSelect={onSelect} />);
    await user.click(dayButton(10));
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(dayButton(11));
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith(date(11));
  });

  it('navigates months and preserves its limits and accessible navigation names', async () => {
    const user = userEvent.setup();
    render(<Calendar defaultMonth={august} today={date(1)} startMonth={august}
      endMonth={new Date(2026, 8, 1)} />);
    const previous = screen.getByRole('button', { name: /anterior/i });
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(screen.getByText('Septiembre 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: /siguiente/i }).getAttribute('aria-disabled')).toBe('true');
    await user.click(screen.getByRole('button', { name: /anterior/i }));
    expect(screen.getByText('Agosto 2026')).toBeTruthy();
  });

  it('keeps focus in the replacement grid on controlled month and selected changes', async () => {
    const user = userEvent.setup();
    const initial = date(10);
    const next = new Date(2026, 8, 15);
    const onSelect = vi.fn();
    const view = render(<Calendar mode="single" month={august} selected={initial} onSelect={onSelect} today={date(1)} />);
    await user.click(dayButton(10));
    view.rerender(<Calendar mode="single" month={new Date(2026, 8, 1)} selected={next} onSelect={onSelect} today={date(1)} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /15 de septiembre de 2026/i }));
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /16 de septiembre de 2026/i }));
  });

  it('does not steal focus outside the grid during a controlled month change', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const view = render(<><button type="button">Fuera del calendario</button>
      <Calendar mode="single" month={august} selected={date(10)} onSelect={onSelect} today={date(1)} /></>);
    const outside = screen.getByRole('button', { name: 'Fuera del calendario' });
    await user.click(outside);
    view.rerender(<><button type="button">Fuera del calendario</button>
      <Calendar mode="single" month={new Date(2026, 8, 1)} selected={new Date(2026, 8, 15)} onSelect={onSelect} today={date(1)} /></>);
    expect(document.activeElement).toBe(outside);
  });

  it('changes the displayed month and year through accessible dropdowns', async () => {
    const user = userEvent.setup();
    render(<Calendar defaultMonth={august} today={date(1)} captionLayout="dropdown"
      startMonth={new Date(2025, 0, 1)} endMonth={new Date(2027, 11, 1)} />);
    const month = screen.getByRole('combobox', { name: /mes/i });
    const year = screen.getByRole('combobox', { name: /año/i });
    await user.selectOptions(month, '8');
    await user.selectOptions(year, '2027');
    expect(screen.getByRole('grid', { name: /septiembre 2027/i })).toBeTruthy();
    expect(within(month).getByRole('option', { name: 'Septiembre' }).getAttribute('value')).toBe('8');
  });

  it('renders week numbers without moving day semantics or selected range hooks', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Calendar mode="single" defaultMonth={august} today={date(1)}
      showWeekNumber onSelect={onSelect} />);
    const grid = screen.getByRole('grid');
    expect(grid.querySelectorAll('thead th')).toHaveLength(8);
    const weekNumbers = grid.querySelectorAll('.rdp-week_number');
    expect(weekNumbers.length).toBeGreaterThan(0);
    expect(weekNumbers[0]?.getAttribute('role')).toBe('rowheader');
    expect(weekNumbers[0]?.tagName).toBe('TH');
    expect(weekNumbers[0]?.hasAttribute('week')).toBe(false);
    expect(weekNumbers[0]?.getAttribute('aria-label')).toMatch(/^Semana \d+$/);
    await user.click(dayButton(10));
    expect(onSelect.mock.calls[0]?.[0]).toEqual(date(10));
  });
});
