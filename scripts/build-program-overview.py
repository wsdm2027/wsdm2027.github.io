"""Rebuild the overview from the daily agendas in program-overview.html.
Run with --check to verify that the two views are synchronized.
"""
from html import escape
from html.parser import HTMLParser
from bisect import bisect_left
from pathlib import Path
import sys

PAGE = Path(__file__).resolve().parents[1] / 'program-overview.html'
START, END = '<!-- WEEK GRID START -->', '<!-- WEEK GRID END -->'

def minutes(value):
    hour, minute = map(int, value.split(':'))
    return hour * 60 + minute

def clock(value):
    return f'{value // 60:02}:{value % 60:02}'

class AgendaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.days = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('class') == 'program-day':
            self.days.append([])
        if attrs.get('class') == 'program-slot':
            self.start = minutes(attrs['data-start'])
            self.end = minutes(attrs['data-end'])
        if 'data-event-title' in attrs:
            event = dict(start=self.start, end=self.end,
                title=attrs['data-event-title'], kind=attrs['class'].split()[-1])
            if 'data-closing-start' in attrs:
                event['closing_start'] = minutes(attrs['data-closing-start'])
                assert self.start < event['closing_start'] < self.end
            self.days[-1].append(event)

def build(source):
    parser = AgendaParser()
    parser.feed(source)
    assert len(parser.days) == 5
    beginning, finish, step = 450, 1230, 30
    # Half-hour rows, with registration, lunch and the evening compressed.
    boundaries = [time for time in range(beginning, 1110 + 1, step)
        if time != 480 and not 720 < time < 810] + [finish]
    row_count = len(boundaries) - 1
    row_for_time = {time: row for row, time in enumerate(boundaries)}
    lanes = [3, 2, 2, 2, 3]
    grids = []
    cells = {}
    for day, events in enumerate(parser.days):
        for coffee in events:
            if coffee['title'] != 'Coffee Break':
                continue
            for poster in events:
                if not poster['title'].startswith('Poster Session '):
                    continue
                overlap_start = max(coffee['start'], poster['start'])
                overlap_end = min(coffee['end'], poster['end'])
                if overlap_start < overlap_end:
                    coffee['concurrent_poster'] = True
        grid = [[None] * lanes[day] for _ in range(row_count)]
        for number, event in enumerate(events):
            start, end = event['start'], event['end']
            assert beginning <= start < end <= finish
            concurrent = [other for other in events if other is not event
                and other['start'] < end and other['end'] > start]
            span = lanes[day] if not concurrent else 1
            # Friday's final workshop block occupies two of the three lanes.
            if lanes[day] == 3 and len(concurrent) == 1 and event['title'] == 'Workshops':
                span = 2
            first, last = row_for_time[start], bisect_left(boundaries, end)
            available = [col for col in range(lanes[day] - span + 1)
                if all(grid[row][c] is None for row in range(first, last)
                    for c in range(col, col + span))]
            assert available, f'Overlapping placement: day {day}, {event}'
            col = available[0]
            for row in range(first, last):
                for c in range(col, col + span):
                    grid[row][c] = number
            cells[day, first, col] = (event, last - first, span)
        grids.append(grid)

    output = ['<table class="program-week-table">',
        '  <caption class="program-visually-hidden">WSDM 2027 tentative five-day schedule, February 15–19. Times are in Hong Kong time (UTC+8). Equal-height rows represent 30 minutes, except the 07:30–08:30, 12:00–13:30 and 18:30–20:30 rows, which are each 1.5 times as tall. Simultaneous sessions appear side by side.</caption>',
        '  <colgroup><col class="week-time-column"></colgroup>']
    for day, count in enumerate(lanes):
        output.append(f'  <colgroup class="week-day-columns lanes-{count}"><col span="{count}"></colgroup>')
    output += ['  <thead><tr><th scope="col" id="week-time">HKT<br><span>UTC+8</span></th>']
    for day, name in enumerate(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']):
        output.append(f'    <th scope="colgroup" colspan="{lanes[day]}" id="week-day-{day}">{15 + day} Feb <span>{name}</span></th>')
    output += ['  </tr></thead>', '  <tbody>']
    for row in range(row_count):
        start, end = boundaries[row:row + 2]
        row_class = ' class="week-compressed-row"' if end - start > step else ''
        output.append(f'    <tr{row_class}><th scope="row" id="week-time-{row}">{clock(start)}–{clock(end)}</th>')
        for day, grid in enumerate(grids):
            col = 0
            while col < lanes[day]:
                cell = cells.get((day, row, col))
                if cell:
                    event, rowspan, colspan = cell
                    title = escape(event['title']).replace(' | ', '<br>')
                    closing_start = event.get('closing_start')
                    closing = ''
                    extra_class = ' week-coffee-concurrent' if event.get('concurrent_poster') else ''
                    partial_style = ''
                    if event['end'] not in row_for_time:
                        last = row + rowspan
                        row_duration = boundaries[last] - boundaries[last - 1]
                        row_height = 1.5 if row_duration > step else 1
                        trim = (boundaries[last] - event['end']) / row_duration * row_height
                        extra_class += ' week-event-partial'
                        partial_style = f' style="--event-trim: {trim:.9f}"'
                    if closing_start is not None:
                        extra_class += ' week-event-with-closing'
                        closing = f'<span class="week-event-closing">Closing<span class="week-event-time">{clock(closing_start)}–{clock(event["end"])}</span></span>'
                    presentation_end = closing_start if closing_start is not None else event['end']
                    output.append(f'      <td class="week-{event["kind"]}{extra_class}" rowspan="{rowspan}" colspan="{colspan}" headers="week-day-{day} week-time-{row}"{partial_style}><div class="week-event-content"><span class="week-event-title">{title}</span><span class="week-event-time">{clock(event["start"])}–{clock(presentation_end)}</span>{closing}</div></td>')
                    col += colspan
                elif grid[row][col] is None:
                    span = 1
                    while col + span < lanes[day] and grid[row][col + span] is None:
                        span += 1
                    output.append(f'      <td class="week-empty" colspan="{span}" headers="week-day-{day} week-time-{row}"><span class="program-visually-hidden">No session scheduled</span></td>')
                    col += span
                else:
                    col += 1
        output.append('    </tr>')
    output += ['  </tbody>', '</table>']
    return '\n'.join(output)

if __name__ == '__main__':
    source = PAGE.read_text()
    generated = build(source)
    start = source.index(START) + len(START)
    end = source.index(END, start)
    updated = source[:start] + '\n' + generated + '\n        ' + source[end:]
    if '--check' in sys.argv:
        assert updated == source, 'Week grid is out of date; run scripts/build-program-overview.py'
        print('Week grid matches all daily session times.')
    else:
        PAGE.write_text(updated)
