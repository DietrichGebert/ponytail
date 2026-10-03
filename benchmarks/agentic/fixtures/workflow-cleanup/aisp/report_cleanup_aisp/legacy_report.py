"""Retired reporting helper, kept only to give cleanup a genuine deletion target."""


def format_old_report(numbers):
    rows = []
    for number in numbers:
        rows.append(f"value={number}")
    return "\n".join(rows)
