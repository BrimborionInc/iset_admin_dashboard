#!/usr/bin/env python3
"""Sanitize known restore-incompatible MySQL dump output for TEST rehearsal."""

import sys

TARGET_TABLE = "iset_case_conflict_declaration"
GENERATED_COLUMN = "is_active"
TARGET_COLUMNS_WITHOUT_GENERATED = [
    "`id`",
    "`case_id`",
    "`staff_profile_id`",
    "`declaration_choice`",
    "`conflict_details`",
    "`signed_at`",
    "`signed_ip`",
    "`signed_user_agent`",
    "`revoked_at`",
    "`revoked_reason`",
]


def split_sql_list(text):
    items = []
    current = []
    in_string = False
    escaped = False

    for ch in text:
        if in_string:
            current.append(ch)
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == "'":
                in_string = False
            continue
        if ch == "'":
            in_string = True
            current.append(ch)
            continue
        if ch == ",":
            items.append("".join(current))
            current = []
            continue
        current.append(ch)

    items.append("".join(current))
    return items


def find_tuple_end(text, start_index):
    in_string = False
    escaped = False
    depth = 0

    for index in range(start_index, len(text)):
        ch = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == "'":
                in_string = False
            continue
        if ch == "'":
            in_string = True
            continue
        if ch == "(":
            depth += 1
            continue
        if ch == ")":
            depth -= 1
            if depth == 0:
                return index
    return -1


def remove_value_from_tuple(tuple_text, value_index):
    if not tuple_text.startswith("(") or not tuple_text.endswith(")"):
        return tuple_text
    values = split_sql_list(tuple_text[1:-1])
    if value_index < 0 or value_index >= len(values):
        return tuple_text
    del values[value_index]
    return "(" + ",".join(values) + ")"


def sanitize_values(values_text, value_index):
    output = []
    index = 0

    while index < len(values_text):
        ch = values_text[index]
        if ch != "(":
            output.append(ch)
            index += 1
            continue
        end = find_tuple_end(values_text, index)
        if end == -1:
            output.append(values_text[index:])
            break
        output.append(remove_value_from_tuple(values_text[index : end + 1], value_index))
        index = end + 1

    return "".join(output)


def parse_column_list(prefix):
    open_index = prefix.find("(")
    close_index = prefix.rfind(")")
    if open_index == -1 or close_index == -1 or close_index <= open_index:
        return None
    return {
        "before": prefix[: open_index + 1],
        "columns": prefix[open_index + 1 : close_index],
        "after": prefix[close_index:],
    }


def sanitize_insert_line(line):
    if not (
        line.startswith(f"INSERT INTO `{TARGET_TABLE}` ")
        or line.startswith(f"INSERT INTO `{TARGET_TABLE}`(")
    ):
        return line

    values_marker = " VALUES "
    marker_index = line.find(values_marker)
    if marker_index == -1:
        return line

    prefix = line[:marker_index]
    suffix = line[marker_index + len(values_marker) :]
    value_index = 10

    if "(" in prefix:
        parsed = parse_column_list(prefix)
        if parsed:
            columns = [column.strip() for column in split_sql_list(parsed["columns"])]
            generated_index = next(
                (
                    index
                    for index, column in enumerate(columns)
                    if column.replace("`", "").lower() == GENERATED_COLUMN
                ),
                -1,
            )
            if generated_index != -1:
                del columns[generated_index]
                prefix = f"{parsed['before']}{','.join(columns)}{parsed['after']}"
                value_index = generated_index
    else:
        prefix = f"{prefix} ({','.join(TARGET_COLUMNS_WITHOUT_GENERATED)})"

    return prefix + values_marker + sanitize_values(suffix, value_index)


for raw_line in sys.stdin:
    sys.stdout.write(sanitize_insert_line(raw_line.rstrip("\n")) + "\n")
